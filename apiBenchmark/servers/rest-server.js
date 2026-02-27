/**
 * REST Server - Port 3001
 * Espone endpoint CRUD standard via HTTP/REST
 */
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Database in-memory simulato
const db = {
  users: [
    { id: 1, name: 'Alice Rossi', email: 'alice@example.com', age: 30 },
    { id: 2, name: 'Mario Bianchi', email: 'mario@example.com', age: 25 },
  ],
  products: [
    { id: 1, name: 'Laptop Pro', price: 1299.99, stock: 50 },
    { id: 2, name: 'Mouse Wireless', price: 29.99, stock: 200 },
  ]
};

// ─── HEALTH CHECK ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'REST', timestamp: new Date().toISOString() });
});

// ─── USERS ──────────────────────────────────────────────────────────────────
app.get('/api/users', (req, res) => {
  res.json({ success: true, data: db.users, count: db.users.length });
});

app.get('/api/users/:id', (req, res) => {
  const user = db.users.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).json({ success: false, message: 'Utente non trovato' });
  res.json({ success: true, data: user });
});

app.post('/api/users', (req, res) => {
  const { name, email, age } = req.body;
  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'name e email sono obbligatori' });
  }
  const newUser = { id: db.users.length + 1, name, email, age: age || 0 };
  db.users.push(newUser);
  res.status(201).json({ success: true, data: newUser, message: 'Utente creato' });
});

app.put('/api/users/:id', (req, res) => {
  const idx = db.users.findIndex(u => u.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ success: false, message: 'Utente non trovato' });
  db.users[idx] = { ...db.users[idx], ...req.body };
  res.json({ success: true, data: db.users[idx], message: 'Utente aggiornato' });
});

app.delete('/api/users/:id', (req, res) => {
  const idx = db.users.findIndex(u => u.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ success: false, message: 'Utente non trovato' });
  db.users.splice(idx, 1);
  res.json({ success: true, message: 'Utente eliminato' });
});

// ─── PRODUCTS ───────────────────────────────────────────────────────────────
app.get('/api/products', (req, res) => {
  res.json({ success: true, data: db.products, count: db.products.length });
});

app.get('/api/products/:id', (req, res) => {
  const product = db.products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ success: false, message: 'Prodotto non trovato' });
  res.json({ success: true, data: product });
});

app.post('/api/products', (req, res) => {
  const { name, price, stock } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ success: false, message: 'name e price sono obbligatori' });
  }
  const newProduct = { id: db.products.length + 1, name, price, stock: stock || 0 };
  db.products.push(newProduct);
  res.status(201).json({ success: true, data: newProduct, message: 'Prodotto creato' });
});

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ REST Server avviato su http://localhost:${PORT}`);
  console.log(`   GET  /health`);
  console.log(`   GET  /api/users`);
  console.log(`   POST /api/users`);
  console.log(`   GET  /api/products`);
});

module.exports = app;
