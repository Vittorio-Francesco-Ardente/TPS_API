/**
 * gRPC Server - Port 3003  (+ HTTP health check su porta 3004)
 *
 * RPC esposte:
 *   UserService    : HealthCheck
 *   ProductService : GetProducts, GetProductById, CreateProduct
 *   BenchmarkService: Call (adapter per api-benchmark)
 *
 * CreateProduct accetta un campo 'notes' (stringa) che funge da padding
 * per il payload variabile nel benchmark — non viene salvato nel DB.
 *
 * HTTP health (porta 3004): endpoint GET /health per il frontend React
 * che non può usare il transport gRPC binario via fetch().
 */

const grpc        = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path        = require('path');
const http        = require('http');
const os          = require('os');

const NUM_CORES = os.cpus().length;

// ─── PORTE ────────────────────────────────────────────────────────────────────
const GRPC_PORT        = 3003;   // transport gRPC binario (HTTP/2)
const HTTP_HEALTH_PORT = 3004;   // health check HTTP per il frontend React

// ─── CARICA PROTO APPLICATIVO ─────────────────────────────────────────────────
const PROTO_PATH = path.join(__dirname, '../../proto/service.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const proto = grpc.loadPackageDefinition(packageDef).userservice;

// ─── CARICA PROTO BENCHMARK (api-benchmark interno) ───────────────────────────
const BM_PROTO_PATH = path.join(
  __dirname,
  '../../node_modules/api-benchmark/lib/grpc-benchmark.proto'
);
const bmPackageDef = protoLoader.loadSync(BM_PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const bmProto = grpc.loadPackageDefinition(bmPackageDef).benchmark;

// ─── DATABASE IN-MEMORY ───────────────────────────────────────────────────────
let users = [
  { id: 1, name: 'Alice Rossi',   email: 'alice@example.com',  age: 30, role: 'admin' },
  { id: 2, name: 'Mario Bianchi', email: 'mario@example.com',  age: 25, role: 'user'  },
];

let products = [
  { id: 1, name: 'Laptop Pro',     price: 1299.99, stock: 50,  category: 'tech' },
  { id: 2, name: 'Mouse Wireless', price: 29.99,   stock: 200, category: 'tech' },
  { id: 3, name: 'Scrivania Oak',  price: 349.00,  stock: 15,  category: 'home' },
];

// ─── UserService ──────────────────────────────────────────────────────────────
const userServiceImpl = {
  HealthCheck: (call, callback) => {
    callback(null, { status: 'ok', server: 'gRPC', timestamp: new Date().toISOString() });
  },
  GetUsers: (call, callback) => {
    callback(null, { success: true, users, count: users.length });
  },
  GetUserById: (call, callback) => {
    const user = users.find(u => u.id === call.request.id);
    if (!user) return callback(null, { success: false, message: 'Utente non trovato' });
    callback(null, { success: true, user, message: 'OK' });
  },
  CreateUser: (call, callback) => {
    const { name, email, age, role } = call.request;
    if (!name || !email)
      return callback(null, { success: false, message: 'name e email obbligatori', id: 0 });
    const newUser = { id: users.length + 1, name, email, age: age || 0, role: role || 'user' };
    users.push(newUser);
    callback(null, { success: true, message: 'Utente creato', id: newUser.id });
  },
  DeleteUser: (call, callback) => {
    const idx = users.findIndex(u => u.id === call.request.id);
    if (idx === -1)
      return callback(null, { success: false, message: 'Non trovato', id: call.request.id });
    users.splice(idx, 1);
    callback(null, { success: true, message: 'Utente eliminato', id: call.request.id });
  },
};

// ─── ProductService ───────────────────────────────────────────────────────────
const productServiceImpl = {
  GetProducts: (call, callback) => {
    callback(null, { success: true, products, count: products.length });
  },
  GetProductById: (call, callback) => {
    const product = products.find(p => p.id === call.request.id);
    if (!product) return callback(null, { success: false, message: 'Prodotto non trovato' });
    callback(null, { success: true, product, message: 'OK' });
  },
  // CreateProduct accetta 'notes' come campo di padding per payload variabile.
  // Il campo è definito nel proto come 'category' (stringa già presente) —
  // usiamo il campo 'category' per passare i dati extra senza toccare il proto,
  // oppure usiamo il payload JSON grezzo via BenchmarkService.
  // Nel BenchmarkService adapter gestiamo 'notes' esplicitamente.
  CreateProduct: (call, callback) => {
    const { name, price, stock, category } = call.request;
    if (!name || price === undefined)
      return callback(null, { success: false, message: 'name e price obbligatori', id: 0 });
    const newProduct = {
      id:       products.length + 1,
      name,
      price,
      stock:    stock    || 0,
      category: category || 'general',
    };
    products.push(newProduct);
    callback(null, { success: true, message: 'Prodotto creato', id: newProduct.id });
  }
};

// ─── BenchmarkService adapter ─────────────────────────────────────────────────
// api-benchmark chiama sempre BenchmarkService.Call({ method, payload }).
// Questo adapter smista alla RPC reale e gestisce il campo 'notes' (padding).

function parsePayload(buf) {
  try { return (buf && buf.length > 0) ? JSON.parse(buf.toString()) : {}; }
  catch (e) { return {}; }
}

function respond(callback, data) {
  callback(null, { status: 0, body: Buffer.from(JSON.stringify(data)), message: 'OK' });
}

function respondError(callback, message, status) {
  callback(null, { status: status || 1, body: Buffer.from('{}'), message });
}

const benchmarkServiceImpl = {
  Call(call, callback) {
    const method  = call.request.method;
    const payload = parsePayload(call.request.payload);

    // 'notes' è il campo padding per payload variabile —
    // viene letto per misurare receivedBytes ma non salvato nel DB.
    const notesLen = payload.notes ? payload.notes.length : 0;

    const fakeCall = { request: payload };

    switch (method) {

      case 'HealthCheck':
        userServiceImpl.HealthCheck(fakeCall, (err, res) => {
          if (err) return respondError(callback, err.message);
          respond(callback, res);
        });
        break;

      case 'GetProducts':
        productServiceImpl.GetProducts(fakeCall, (err, res) => {
          if (err) return respondError(callback, err.message);
          respond(callback, res);
        });
        break;

      case 'GetProductById':
        productServiceImpl.GetProductById(fakeCall, (err, res) => {
          if (err) return respondError(callback, err.message);
          respond(callback, res);
        });
        break;

      // CreateProduct con payload variabile:
      // il payload include name, price, stock, category + notes (padding).
      // 'notes' viene estratto e misurato ma non passato al DB.
      case 'CreateProduct': {
        const { notes, ...productFields } = payload;  // separa il padding
        const fakeCallClean = { request: productFields };
        productServiceImpl.CreateProduct(fakeCallClean, (err, res) => {
          if (err) return respondError(callback, err.message);
          // aggiunge info debug alla risposta
          respond(callback, { ...res, notesLen });
        });
        break;
      }

      case 'GetUsers':
        userServiceImpl.GetUsers(fakeCall, (err, res) => {
          if (err) return respondError(callback, err.message);
          respond(callback, res);
        });
        break;

      case 'GetUserById':
        userServiceImpl.GetUserById(fakeCall, (err, res) => {
          if (err) return respondError(callback, err.message);
          respond(callback, res);
        });
        break;

      case 'CreateUser':
        userServiceImpl.CreateUser(fakeCall, (err, res) => {
          if (err) return respondError(callback, err.message);
          respond(callback, res);
        });
        break;

      case 'DeleteUser':
        userServiceImpl.DeleteUser(fakeCall, (err, res) => {
          if (err) return respondError(callback, err.message);
          respond(callback, res);
        });
        break;

      default:
        respondError(callback, `Metodo sconosciuto: ${method}`, 14);
    }
  }
};

// ─── AVVIA SERVER gRPC ────────────────────────────────────────────────────────
const server = new grpc.Server();

server.addService(proto.UserService.service,        userServiceImpl);
server.addService(proto.ProductService.service,     productServiceImpl);
server.addService(bmProto.BenchmarkService.service, benchmarkServiceImpl);

server.bindAsync(
  `0.0.0.0:${GRPC_PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) { console.error('[gRPC] Errore avvio:', err); process.exit(1); }
    console.log(`✅ gRPC Server avviato su localhost:${GRPC_PORT}`);
    console.log(`   UserService    → HealthCheck, GetUsers, GetUserById, CreateUser, DeleteUser`);
    console.log(`   ProductService → GetProducts, GetProductById, CreateProduct`);
    console.log(`   BenchmarkService → Call (adapter api-benchmark)`);
    console.log(`   CreateProduct accetta 'notes' come campo padding per payload variabile`);
  }
);

// ─── HTTP SERVER (porta 3004): /health + /metrics ─────────────────────────────
// Il frontend React e il benchmark usano questo server HTTP per:
//   GET /health  → connectivity check (non può usare il transport gRPC binario)
//   GET /metrics → memoria + CPU del processo gRPC server in tempo reale
//
// CPU: campionamento delta — process.cpuUsage(prev) restituisce µs dall'ultima
// chiamata, convertiamo in % sull'intervallo trascorso tra i due campioni.
let _lastCpuUsage = process.cpuUsage();
let _lastCpuTime  = Date.now();

const CORS_HEADERS = {
  'Content-Type':                 'application/json',
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const httpHealthServer = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  res.writeHead(200, CORS_HEADERS);

  if (req.url === '/metrics') {
    const mem       = process.memoryUsage();
    const now       = Date.now();
    const cpuDelta  = process.cpuUsage(_lastCpuUsage);
    const elapsedMs = now - _lastCpuTime || 1;

    const cpuUserPct   = (cpuDelta.user   / (elapsedMs * 1000 * NUM_CORES)) * 100;
    const cpuSystemPct = (cpuDelta.system / (elapsedMs * 1000 * NUM_CORES)) * 100;

    _lastCpuUsage = process.cpuUsage();
    _lastCpuTime  = now;

    res.end(JSON.stringify({
      server:    'gRPC',
      timestamp: now,
      cores:     NUM_CORES,
      memory: {
        rss:       +(mem.rss       / 1048576).toFixed(2),
        heapTotal: +(mem.heapTotal / 1048576).toFixed(2),
        heapUsed:  +(mem.heapUsed  / 1048576).toFixed(2),
        external:  +(mem.external  / 1048576).toFixed(2),
      },
      cpu: {
        userPct:   +cpuUserPct.toFixed(2),
        systemPct: +cpuSystemPct.toFixed(2),
        totalPct:  +(cpuUserPct + cpuSystemPct).toFixed(2),
      },
    }));
    return;
  }

  // Default: /health (e qualsiasi altra rotta)
  res.end(JSON.stringify({
    status:    'ok',
    server:    'gRPC',
    grpcPort:  GRPC_PORT,
    timestamp: new Date().toISOString()
  }));
});

httpHealthServer.listen(HTTP_HEALTH_PORT, () => {
  console.log(`✅ gRPC HTTP server su http://localhost:${HTTP_HEALTH_PORT}`);
  console.log(`   GET /health  → connectivity check`);
  console.log(`   GET /metrics → memoria + CPU (campionamento delta)`);
});
