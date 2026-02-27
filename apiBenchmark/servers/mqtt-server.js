/**
 * MQTT Server - Broker porta 1883 + HTTP Bridge porta 3002
 * Usa Aedes come broker MQTT. Espone anche un bridge HTTP
 * per permettere ad api-benchmark di misurare le performance.
 *
 * Pattern:
 *   - Il client pubblica su un topic e aspetta risposta su topic/reply
 *   - Il bridge HTTP wrappa publish/subscribe in endpoint HTTP
 */
const aedes = require('aedes')();
const net = require('net');
const express = require('express');
const bodyParser = require('body-parser');
const mqtt = require('mqtt');

// ─── MQTT BROKER ─────────────────────────────────────────────────────────────
const broker = net.createServer(aedes.handle);
const MQTT_PORT = 1883;

broker.listen(MQTT_PORT, () => {
  console.log(`✅ MQTT Broker avviato su mqtt://localhost:${MQTT_PORT}`);
});

// Logica broker: rispondi ai messaggi in arrivo
aedes.on('publish', (packet, client) => {
  if (!client) return; // messaggi interni
  const topic = packet.topic;

  if (topic === 'api/users/get') {
    const users = [
      { id: 1, name: 'Alice Rossi' },
      { id: 2, name: 'Mario Bianchi' },
    ];
    aedes.publish({
      topic: 'api/users/reply',
      payload: JSON.stringify({ success: true, data: users }),
      qos: 1,
      retain: false
    }, () => {});
  }

  if (topic === 'api/ping') {
    aedes.publish({
      topic: 'api/pong',
      payload: JSON.stringify({ pong: true, timestamp: Date.now() }),
      qos: 0,
      retain: false
    }, () => {});
  }
});

aedes.on('client', client => {
  console.log(`[MQTT] Client connesso: ${client.id}`);
});

// ─── HTTP BRIDGE ─────────────────────────────────────────────────────────────
// api-benchmark lavora su HTTP, quindi creiamo un bridge
const app = express();
app.use(bodyParser.json());

// Client MQTT interno per il bridge
let bridgeClient = null;

function getBridgeClient() {
  if (bridgeClient && bridgeClient.connected) return bridgeClient;
  bridgeClient = mqtt.connect(`mqtt://localhost:${MQTT_PORT}`, {
    clientId: 'http-bridge-' + Math.random().toString(16).slice(2),
    clean: true,
    reconnectPeriod: 1000
  });
  return bridgeClient;
}

// Funzione helper: pubblica e aspetta risposta
function publishAndWait(client, pubTopic, subTopic, payload, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.unsubscribe(subTopic);
      reject(new Error('Timeout MQTT'));
    }, timeout);

    client.subscribe(subTopic, { qos: 1 }, () => {
      client.publish(pubTopic, JSON.stringify(payload), { qos: 1 });
    });

    client.once('message', (topic, message) => {
      if (topic === subTopic) {
        clearTimeout(timer);
        client.unsubscribe(subTopic);
        try {
          resolve(JSON.parse(message.toString()));
        } catch (e) {
          resolve({ raw: message.toString() });
        }
      }
    });
  });
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'MQTT-Bridge', mqttPort: MQTT_PORT });
});

app.get('/mqtt/users', async (req, res) => {
  try {
    const client = getBridgeClient();
    const result = await publishAndWait(client, 'api/users/get', 'api/users/reply', {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/mqtt/ping', async (req, res) => {
  try {
    const client = getBridgeClient();
    const result = await publishAndWait(client, 'api/ping', 'api/pong', {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/mqtt/publish', async (req, res) => {
  const { topic, message } = req.body;
  if (!topic) return res.status(400).json({ error: 'topic obbligatorio' });
  const client = getBridgeClient();
  client.publish(topic, JSON.stringify(message || {}), { qos: 1 });
  res.json({ success: true, published: { topic, message } });
});

const HTTP_PORT = 3002;
app.listen(HTTP_PORT, () => {
  console.log(`✅ MQTT HTTP Bridge avviato su http://localhost:${HTTP_PORT}`);
  console.log(`   GET  /health`);
  console.log(`   GET  /mqtt/users  (pubblica su MQTT e aspetta risposta)`);
  console.log(`   GET  /mqtt/ping`);
  console.log(`   POST /mqtt/publish`);
});
