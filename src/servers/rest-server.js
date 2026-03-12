/**
 * REST Server - Port 3001
 * Rotte esposte:
 *   GET  /health                  → health check
 *   GET  /api/products            → lista prodotti
 *   POST /api/products            → crea prodotto (payload variabile via description)
 */
const express    = require('express');
const bodyParser = require('body-parser');
const os         = require('os');

const NUM_CORES = os.cpus().length;

const cors = require('cors');
const app = express();
app.use(cors());

// Aumenta il limite del body parser per accettare payload grandi (es. 64 KB)
app.use(bodyParser.json({ limit: '1mb' }));

// ─── DATABASE IN-MEMORY ───────────────────────────────────────────────────────
const db = {
  users: [
    { id: 1, name: 'Alice Rossi',   email: 'alice@example.com',  age: 30 },
    { id: 2, name: 'Mario Bianchi', email: 'mario@example.com',  age: 25 },
  ],
  products: [
    { id: 1, name: 'Laptop Pro',      price: 1299.99, stock: 50,  category: 'tech' },
    { id: 2, name: 'Mouse Wireless',  price: 29.99,   stock: 200, category: 'tech' },
    { id: 3, name: 'Scrivania Oak',   price: 349.00,  stock: 15,  category: 'home' },
  ]
};

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'REST', timestamp: new Date().toISOString() });
});

// ─── METRICS ──────────────────────────────────────────────────────────────────
// Espone memoria e CPU del processo server in tempo reale.
//
// Memoria  → process.memoryUsage() (valori istantanei in MB)
//   rss       : Resident Set Size — tutta la RAM occupata dal processo OS
//   heapTotal : heap totale allocato da V8
//   heapUsed  : heap effettivamente usato (oggetti JS vivi)
//   external  : memoria C++ esterna a V8 (Buffer, binding nativi)
//
// CPU      → process.cpuUsage(prev) restituisce microsecondi DELTA
//            dall'ultima chiamata — convertiamo in % su un intervallo di 100ms.
//            user   : tempo CPU in user-space (logica JS)
//            system : tempo CPU in kernel-space (I/O, syscall)
//
// Il client deve chiamare /metrics periodicamente (es. ogni 250ms) e calcolare
// peak/avg sull'array di campioni raccolti durante il benchmark.

let _lastCpuUsage  = process.cpuUsage();
let _lastCpuTime   = Date.now();

app.get('/metrics', (req, res) => {
  const mem        = process.memoryUsage();
  const now        = Date.now();
  const cpuDelta   = process.cpuUsage(_lastCpuUsage);   // µs dall'ultima lettura
  const elapsedMs  = now - _lastCpuTime || 1;           // ms trascorsi (min 1 per /0)

  // Percentuale CPU: (µs usati / µs disponibili) * 100
  // µs disponibili = elapsedMs * 1000 (un solo core; moltiplica per os.cpus().length per multi-core)
  // Normalizzato su tutti i core: max 100% indipendentemente dal numero di CPU
  const cpuUserPct   = (cpuDelta.user   / (elapsedMs * 1000 * NUM_CORES)) * 100;
  const cpuSystemPct = (cpuDelta.system / (elapsedMs * 1000 * NUM_CORES)) * 100;

  _lastCpuUsage = process.cpuUsage();
  _lastCpuTime  = now;

  res.json({
    server: 'REST',
    timestamp: now,
    cores: NUM_CORES,
    memory: {
      rss:       +(mem.rss       / 1048576).toFixed(2),
      heapTotal: +(mem.heapTotal / 1048576).toFixed(2),
      heapUsed:  +(mem.heapUsed  / 1048576).toFixed(2),
      external:  +(mem.external  / 1048576).toFixed(2),
    },
    cpu: {
      userPct:   +cpuUserPct.toFixed(2),
      systemPct: +cpuSystemPct.toFixed(2),
      totalPct:  +(cpuUserPct + cpuSystemPct).toFixed(2),  // sempre ≤ 100%
    },
  });
});

// ─── GET /api/products ────────────────────────────────────────────────────────
// Restituisce tutti i prodotti del catalogo.
app.get('/api/products', (req, res) => {
  res.json({ success: true, data: db.products, count: db.products.length });
});

// ─── POST /api/products ───────────────────────────────────────────────────────
// Crea un nuovo prodotto.
// Campi obbligatori : name, price
// Campi opzionali   : stock, category
// Campo padding     : description (stringa arbitrariamente lunga — usata per
//                     variare la dimensione del payload senza alterare la logica)
//
// Il server legge tutti i campi, esegue la validazione, e ignora description
// nel record salvato (non inquina il DB) ma la misura nel log di debug.
app.post('/api/products', (req, res) => {
  const { name, price, stock, category, description } = req.body;

  if (!name || price === undefined) {
    return res.status(400).json({
      success: false,
      message: 'name e price sono obbligatori'
    });
  }

  const newProduct = {
    id:          db.products.length + 1,
    name,
    price:       parseFloat(price),
    stock:       stock  || 0,
    category:    category    || 'general',
    // description NON viene salvata nel DB — serve solo a gonfiare il payload
  };

  db.products.push(newProduct);

  res.status(201).json({
    success:         true,
    data:            newProduct,
    message:         'Prodotto creato',
    receivedBytes:   JSON.stringify(req.body).length,   // utile per debug
    descriptionLen:  description ? description.length : 0,
  });
});

// ─── (mantenute per compatibilità con gli altri test) ─────────────────────────
app.get('/api/users', (req, res) => {
  res.json({ success: true, data: db.users, count: db.users.length });
});

app.post('/api/users', (req, res) => {
  const { name, email, age } = req.body;
  if (!name || !email)
    return res.status(400).json({ success: false, message: 'name e email sono obbligatori' });
  const newUser = { id: db.users.length + 1, name, email, age: age || 0 };
  db.users.push(newUser);
  res.status(201).json({ success: true, data: newUser, message: 'Utente creato' });
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ REST Server avviato su http://localhost:${PORT}`);
  console.log(`   GET  /health`);
  console.log(`   GET  /api/products`);
  console.log(`   POST /api/products   ← payload variabile via campo 'description'`);
});

module.exports = app;
