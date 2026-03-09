/**
 * grpc-server.js  (versione aggiornata con BenchmarkService)
 *
 * Aggiunge BenchmarkService.Call al server gRPC esistente, permettendo
 * ad api-benchmark di misurare le RPC native (GetUsers, GetProducts, ecc.)
 * attraverso il suo protocollo interno.
 */

const grpc        = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path        = require('path');

// ─── CARICA PROTO APPLICATIVO ─────────────────────────────────────────────────
const PROTO_PATH = path.join(__dirname, '../proto/service.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const proto = grpc.loadPackageDefinition(packageDef).userservice;

// ─── CARICA PROTO BENCHMARK (api-benchmark interno) ───────────────────────────
const BM_PROTO_PATH = path.join(
  __dirname,
  '../node_modules/api-benchmark/lib/grpc-benchmark.proto'
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
];

// ─── IMPLEMENTAZIONE UserService ──────────────────────────────────────────────
const userServiceImpl = {
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
  HealthCheck: (call, callback) => {
    callback(null, { status: 'ok', server: 'gRPC', timestamp: new Date().toISOString() });
  }
};

// ─── IMPLEMENTAZIONE ProductService ───────────────────────────────────────────
const productServiceImpl = {
  GetProducts: (call, callback) => {
    callback(null, { success: true, products, count: products.length });
  },
  GetProductById: (call, callback) => {
    const product = products.find(p => p.id === call.request.id);
    if (!product) return callback(null, { success: false, message: 'Prodotto non trovato' });
    callback(null, { success: true, product, message: 'OK' });
  },
  CreateProduct: (call, callback) => {
    const { name, price, stock, category } = call.request;
    if (!name || price === undefined)
      return callback(null, { success: false, message: 'name e price obbligatori', id: 0 });
    const newProduct = { id: products.length + 1, name, price, stock: stock || 0, category: category || 'general' };
    products.push(newProduct);
    callback(null, { success: true, message: 'Prodotto creato', id: newProduct.id });
  }
};

// ─── IMPLEMENTAZIONE BenchmarkService ─────────────────────────────────────────
//
// Questo adapter riceve le chiamate da api-benchmark e le smista
// alle implementazioni reali in base a BenchmarkRequest.method.

function parsePayload(buf) {
  try {
    return (buf && buf.length > 0) ? JSON.parse(buf.toString()) : {};
  } catch (e) {
    return {};
  }
}

function respond(callback, data) {
  callback(null, {
    status:  0,
    body:    Buffer.from(JSON.stringify(data)),
    message: 'OK'
  });
}

function respondError(callback, message, status) {
  callback(null, {
    status:  status || 1,
    body:    Buffer.from('{}'),
    message: message
  });
}

const benchmarkServiceImpl = {
  Call(call, callback) {
    const method  = call.request.method;
    const payload = parsePayload(call.request.payload);

    // Costruisce un oggetto `call` finto per riusare le implementazioni esistenti
    const fakeCall = { request: payload };

    switch (method) {

      case 'HealthCheck':
        userServiceImpl.HealthCheck(fakeCall, (err, res) => {
          if (err) return respondError(callback, err.message);
          respond(callback, res);
        });
        break;

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

      case 'CreateProduct':
        productServiceImpl.CreateProduct(fakeCall, (err, res) => {
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

const GRPC_PORT = 3003;
const server    = new grpc.Server();

// Servizi applicativi (per i client normali)
server.addService(proto.UserService.service,    userServiceImpl);
server.addService(proto.ProductService.service, productServiceImpl);

// Servizio benchmark (per api-benchmark)
server.addService(bmProto.BenchmarkService.service, benchmarkServiceImpl);

server.bindAsync(
  `0.0.0.0:${GRPC_PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) { console.error('[gRPC] Errore avvio:', err); process.exit(1); }
    console.log(`✅ gRPC Server avviato su localhost:${GRPC_PORT}`);
    console.log(`   UserService       → GetUsers, GetUserById, CreateUser, DeleteUser, HealthCheck`);
    console.log(`   ProductService    → GetProducts, GetProductById, CreateProduct`);
    console.log(`   BenchmarkService  → Call (usato da api-benchmark)`);
  }
);
