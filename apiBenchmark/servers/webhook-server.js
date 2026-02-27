/**
 * Webhook Server - Port 3005
 * Pattern Webhooks:
 *   - I client si registrano per ricevere notifiche su eventi
 *   - Il server invia POST al URL del client quando l'evento accade
 *   - Espone endpoint per registrazione e trigger manuale degli eventi
 */
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.json());

// ─── STORAGE IN-MEMORY ────────────────────────────────────────────────────────
const subscriptions = new Map();   // id -> { url, events, secret, createdAt }
const eventLog = [];               // storico eventi inviati
const deliveryLog = [];            // log consegne webhook

// ─── UTILITY ─────────────────────────────────────────────────────────────────
function generateSignature(payload, secret) {
  return 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

async function deliverWebhook(subscription, event, payload) {
  const signature = generateSignature(payload, subscription.secret);
  const delivery = {
    id: crypto.randomUUID(),
    subscriptionId: subscription.id,
    event,
    url: subscription.url,
    payload,
    timestamp: new Date().toISOString(),
    status: 'pending'
  };

  try {
    const response = await axios.post(subscription.url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event,
        'X-Webhook-Signature': signature,
        'X-Webhook-Delivery': delivery.id,
      },
      timeout: 5000
    });
    delivery.status = 'delivered';
    delivery.statusCode = response.status;
  } catch (err) {
    delivery.status = 'failed';
    delivery.error = err.message;
  }

  deliveryLog.push(delivery);
  return delivery;
}

// ─── ENDPOINT: SOTTOSCRIZIONE ─────────────────────────────────────────────────
app.post('/webhooks/subscribe', (req, res) => {
  const { url, events, secret } = req.body;
  if (!url || !events || !Array.isArray(events)) {
    return res.status(400).json({
      success: false,
      message: 'url e events (array) sono obbligatori'
    });
  }

  const id = crypto.randomUUID();
  const subscription = {
    id,
    url,
    events,
    secret: secret || crypto.randomBytes(20).toString('hex'),
    createdAt: new Date().toISOString(),
    active: true
  };
  subscriptions.set(id, subscription);

  res.status(201).json({
    success: true,
    message: 'Webhook registrato',
    data: { id, url, events, secret: subscription.secret }
  });
});

// ─── ENDPOINT: LISTA SOTTOSCRIZIONI ──────────────────────────────────────────
app.get('/webhooks/subscriptions', (req, res) => {
  const list = Array.from(subscriptions.values());
  res.json({ success: true, data: list, count: list.length });
});

// ─── ENDPOINT: CANCELLA SOTTOSCRIZIONE ───────────────────────────────────────
app.delete('/webhooks/subscriptions/:id', (req, res) => {
  const id = req.params.id;
  if (!subscriptions.has(id)) {
    return res.status(404).json({ success: false, message: 'Sottoscrizione non trovata' });
  }
  subscriptions.delete(id);
  res.json({ success: true, message: 'Sottoscrizione cancellata' });
});

// ─── ENDPOINT: TRIGGER EVENTO ─────────────────────────────────────────────────
app.post('/webhooks/trigger', async (req, res) => {
  const { event, data } = req.body;
  if (!event) return res.status(400).json({ success: false, message: 'event è obbligatorio' });

  const payload = {
    event,
    data: data || {},
    triggeredAt: new Date().toISOString(),
    id: crypto.randomUUID()
  };

  eventLog.push(payload);

  // Trova i subscriber interessati all'evento
  const interested = Array.from(subscriptions.values()).filter(
    s => s.active && s.events.includes(event)
  );

  // Consegna in parallelo
  const deliveries = await Promise.all(
    interested.map(sub => deliverWebhook(sub, event, payload))
  );

  res.json({
    success: true,
    event,
    deliveries: deliveries.length,
    results: deliveries.map(d => ({ id: d.id, url: d.url, status: d.status }))
  });
});

// ─── ENDPOINT: EVENTI SIMULATI (utili per benchmark) ─────────────────────────
app.post('/webhooks/simulate/user-created', async (req, res) => {
  const user = req.body.user || { id: Date.now(), name: 'Test User', email: 'test@example.com' };
  const payload = {
    event: 'user.created',
    data: user,
    triggeredAt: new Date().toISOString(),
    id: crypto.randomUUID()
  };
  eventLog.push(payload);

  const interested = Array.from(subscriptions.values()).filter(
    s => s.active && s.events.includes('user.created')
  );
  const deliveries = await Promise.all(interested.map(s => deliverWebhook(s, 'user.created', payload)));

  res.json({ success: true, event: 'user.created', payload, deliveries: deliveries.length });
});

// ─── ENDPOINT: LOG ────────────────────────────────────────────────────────────
app.get('/webhooks/logs', (req, res) => {
  res.json({
    success: true,
    events: eventLog.slice(-50),
    deliveries: deliveryLog.slice(-50)
  });
});

// ─── HEALTH & INFO ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'Webhooks',
    subscriptions: subscriptions.size,
    totalEvents: eventLog.length,
    totalDeliveries: deliveryLog.length
  });
});

// ─── RECEIVER DI TEST (simula client che riceve webhook) ─────────────────────
app.post('/webhooks/receiver', (req, res) => {
  const event = req.headers['x-webhook-event'] || 'unknown';
  const delivery = req.headers['x-webhook-delivery'] || 'none';
  console.log(`[Webhook Receiver] Ricevuto evento: ${event}, delivery: ${delivery}`);
  res.json({ received: true, event, delivery, timestamp: new Date().toISOString() });
});

const PORT = 3005;
app.listen(PORT, () => {
  console.log(`✅ Webhook Server avviato su http://localhost:${PORT}`);
  console.log(`   POST /webhooks/subscribe      - registra sottoscrizione`);
  console.log(`   GET  /webhooks/subscriptions  - lista sottoscrizioni`);
  console.log(`   POST /webhooks/trigger        - trigger evento manuale`);
  console.log(`   POST /webhooks/simulate/user-created`);
  console.log(`   GET  /webhooks/logs           - log eventi e consegne`);
  console.log(`   POST /webhooks/receiver       - endpoint di test ricezione`);
});

module.exports = app;
