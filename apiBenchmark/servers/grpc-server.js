/**
 * gRPC Server - Porta 50051 + HTTP Bridge porta 3006
 *
 * Espone un server gRPC nativo e un bridge HTTP che wrappa le chiamate gRPC
 * per permettere ad api-benchmark (che lavora su HTTP) di misurare le performance.
 */
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

// ─── CARICA PROTO ─────────────────────────────────────────────────────────────
const PROTO_PATH = path.join(__dirname, '../proto/service.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});
const proto = grpc.loadPackageDefinition(packageDef).userservice;

// ─── DATABASE IN-MEMORY ───────────────────────────────────────────────────────
let users = [
  { id: 1, name: 'Alice Rossi',   email: 'alice@example.com',  age: 30, role: 'admin' },
  { id: 2, name: 'Mario Bianchi', email: 'mario@example.com',  age: 25, role: 'user'  },
];

let products = [
  { id: 1, name: 'Laptop Pro',     price: 1299.99, stock: 50,  category: 'tech' },
  { id: 2, name: 'Mouse Wireless', price: 29.99,   stock: 200, category: 'tech' },
];

// ─── IMPLEMENTAZIONE gRPC ─────────────────────────────────────────────────────
const userServiceImpl = {
  GetUsers: (call, callback) => {
    callback(null, { success: true, users, count: users.length });
  },

  GetUserById: (call, callback) => {
    const user = users.find(u => u.id === call.request.id);
    if (!user) {
      return callback(null, { success: false, message: 'Utente non trovato' });
    }
    callback(null, { success: true, user, message: 'OK' });
  },

  CreateUser: (call, callback) => {
    const { name, email, age, role } = call.request;
    if (!name || !email) {
      return callback(null, { success: false, message: 'name e email obbligatori', id: 0 });
    }
    const newUser = { id: users.length + 1, name, email, age: age || 0, role: role || 'user' };
    users.push(newUser);
    callback(null, { success: true, message: 'Utente creato', id: newUser.id });
  },

  DeleteUser: (call, callback) => {
    const idx = users.findIndex(u => u.id === call.request.id);
    if (idx === -1) {
      return callback(null, { success: false, message: 'Non trovato', id: call.request.id });
    }
    users.splice(idx, 1);
    callback(null, { success: true, message: 'Utente eliminato', id: call.request.id });
  },

  HealthCheck: (call, callback) => {
    callback(null, {
      status: 'ok',
      server: 'gRPC',
      timestamp: new Date().toISOString()
    });
  }
};

const productServiceImpl = {
  GetProducts: (call, callback) => {
    callback(null, { success: true, products, count: products.length });
  },

  GetProductById: (call, callback) => {
    const product = products.find(p => p.id === call.request.id);
    if (!product) {
      return callback(null, { success: false, message: 'Prodotto non trovato' });
    }
    callback(null, { success: true, product, message: 'OK' });
  },

  CreateProduct: (call, callback) => {
    const { name, price, stock, category } = call.request;
    if (!name || price === undefined) {
      return callback(null, { success: false, message: 'name e price obbligatori', id: 0 });
    }
    const newProduct = { id: products.length + 1, name, price, stock: stock || 0, category: category || 'general' };
    products.push(newProduct);
    callback(null, { success: true, message: 'Prodotto creato', id: newProduct.id });
  }
};

// ─── AVVIA SERVER gRPC ────────────────────────────────────────────────────────
const GRPC_PORT = 50051;
const grpcServer = new grpc.Server();
grpcServer.addService(proto.UserService.service, userServiceImpl);
grpcServer.addService(proto.ProductService.service, productServiceImpl);

grpcServer.bindAsync(
  `0.0.0.0:${GRPC_PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) {
      console.error('[gRPC] Errore avvio:', err);
      return;
    }
    console.log(`✅ gRPC Server avviato su localhost:${GRPC_PORT}`);
  }
);

// ─── HTTP BRIDGE (per api-benchmark) ─────────────────────────────────────────
const app = express();
app.use(bodyParser.json());

// Crea un client gRPC interno per il bridge
const userClient = new proto.UserService(
  `localhost:${GRPC_PORT}`,
  grpc.credentials.createInsecure()
);

const productClient = new proto.ProductService(
  `localhost:${GRPC_PORT}`,
  grpc.credentials.createInsecure()
);

function grpcCall(client, method, request = {}) {
  return new Promise((resolve, reject) => {
    client[method](request, (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

app.get('/health', async (req, res) => {
  try {
    const result = await grpcCall(userClient, 'HealthCheck', {});
    res.json({ status: result.status, server: result.server, bridge: 'HTTP->gRPC' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/grpc/users', async (req, res) => {
  try {
    const result = await grpcCall(userClient, 'GetUsers', {});
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/grpc/users/:id', async (req, res) => {
  try {
    const result = await grpcCall(userClient, 'GetUserById', { id: parseInt(req.params.id) });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/grpc/users', async (req, res) => {
  try {
    const result = await grpcCall(userClient, 'CreateUser', req.body);
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/grpc/users/:id', async (req, res) => {
  try {
    const result = await grpcCall(userClient, 'DeleteUser', { id: parseInt(req.params.id) });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/grpc/products', async (req, res) => {
  try {
    const result = await grpcCall(productClient, 'GetProducts', {});
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/grpc/products', async (req, res) => {
  try {
    const result = await grpcCall(productClient, 'CreateProduct', req.body);
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const HTTP_PORT = 3003;
app.listen(HTTP_PORT, () => {
  console.log(`✅ gRPC HTTP Bridge avviato su http://localhost:${HTTP_PORT}`);
  console.log(`   GET  /health`);
  console.log(`   GET  /grpc/users`);
  console.log(`   POST /grpc/users`);
  console.log(`   GET  /grpc/products`);
  console.log(`   gRPC nativo: localhost:${GRPC_PORT}`);
});
