// ═══════════════════════════════════════════════════════════════
// WEBHOOK SERVER — Web Worker (Fixed)
//
// Fix log vs original:
// - deliveryLog era un array che cresceva senza limite (memory leak).
//   Ora ha un cap a 10000 entry con trim automatico.
// - Il calcolo memoryUsedKB includeva processedEvents.size * 0.05,
//   contaminando le metriche di ogni request con lo stato cumulato
//   di tutte le request precedenti. Rimosso.
// - verifySignature usava un hash custom (djb2-like) non standard
//   e non paragonabile a nessun benchmark reale di HMAC-SHA256.
//   Sostituito con SubtleCrypto.verify (asincrono non disponibile
//   in modo sincrono nel Worker) — usiamo una simulazione onesta
//   con costo computazionale O(n) esplicito e documentato.
// - requestSizeBytes e responseSizeBytes usavano new Blob() con
//   overhead di allocazione. Ora usa TextEncoder.
// - crypto.randomUUID() non era nel path critico qui, ok.
// ═══════════════════════════════════════════════════════════════

interface IncomingRequest {
  id: string;
  action: string;
  payload: string;
  timestamp: number;
}

interface ServerResponse {
  id: string;
  action: string;
  result: string;
  serverMetrics: {
    parsingMs: number;
    validationMs: number;
    processingMs: number;
    serializationMs: number;
    totalServerMs: number;
    requestSizeBytes: number;
    responseSizeBytes: number;
    memoryUsedKB: number;
  };
  timestamp: number;
}

const encoderWebhook = new TextEncoder();

function byteLength(s: string): number {
  return encoderWebhook.encode(s).length;
}

const processedEvents: Set<string> = new Set();

// FIX: cap esplicito per deliveryLog
const MAX_LOG_SIZE = 10000;
const deliveryLog: Array<{ eventId: string; timestamp: number; status: string }> = [];

const eventHandlers: Record<string, (data: Record<string, unknown>) => Record<string, unknown>> = {
  'benchmark.test': (data) => ({
    received: true,
    processedLength: typeof data.data === 'string' ? data.data.length : 0,
    timestamp: Date.now(),
  }),
  'benchmark.created': (data) => ({
    received: true,
    id: data.id,
    acknowledged: true,
    timestamp: Date.now(),
  }),
};

// FIX: la verifica è esplicitamente documentata come simulazione sincrona
// di un HMAC — il costo O(n) è reale e proporzionale al payload, ma
// il risultato non è crittograficamente equivalente a SubtleCrypto.
// In un server reale si userebbe SubtleCrypto.verify (asincrono).
function simulateHMACSHA256Cost(payload: string, _secret: string): boolean {
  // Simula costo computazionale lineare simile a HMAC
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  for (let i = 0; i < payload.length; i++) {
    const c = payload.charCodeAt(i);
    h0 = (Math.imul(h0 ^ c, 0x9e3779b9) + h1) | 0;
    h1 = (Math.imul(h1 ^ h0, 0x6c62272e) + h2) | 0;
    h2 = (Math.imul(h2 ^ h1, 0x94d049bb) + h3) | 0;
    h3 = (Math.imul(h3 ^ h2, 0xbf58476d) + h0) | 0;
  }
  // In benchmark mode restituisce sempre true — il costo è la misura
  return (h0 | h1 | h2 | h3) !== undefined;
}

function handleRequestAPI(raw: IncomingRequest): ServerResponse {
  const tTotal = performance.now();

  // ── 1. PARSING ──
  const tParse = performance.now();
  // FIX: TextEncoder invece di Blob
  const requestSizeBytes = byteLength(raw.payload);
  let webhookData: Record<string, unknown>;
  let headers: Record<string, string>;
  try {
    const parsed = JSON.parse(raw.payload);
    headers = (parsed._headers ?? {}) as Record<string, string>;
    delete parsed._headers;
    webhookData = parsed;
  } catch {
    webhookData = {};
    headers = {};
  }
  const parsingMs = performance.now() - tParse;

  // ── 2. VALIDATION ──
  const tValidate = performance.now();
  const signature = headers['X-Webhook-Signature'] ?? '';
  const webhookId = headers['X-Webhook-ID'] ?? (webhookData.webhook_id as string) ?? '';
  const isSignatureValid = simulateHMACSHA256Cost(raw.payload, 'benchmark_secret_key_2024') &&
    signature.startsWith('sha256=');
  const isDuplicate = processedEvents.has(webhookId);
  const eventType = (webhookData.event as string) ?? 'benchmark.test';
  const hasHandler = eventType in eventHandlers;
  const validationMs = performance.now() - tValidate;

  // ── 3. PROCESSING ──
  const tProcess = performance.now();
  let result: Record<string, unknown>;

  if (!isSignatureValid) {
    result = { status: 'rejected', error: 'Invalid signature', code: 401 };
  } else if (isDuplicate) {
    result = { status: 'duplicate', message: 'Event already processed', code: 200, webhookId };
  } else if (!hasHandler) {
    result = { status: 'unhandled', message: `No handler for event type: ${eventType}`, code: 200 };
  } else {
    const handler = eventHandlers[eventType];
    const handlerResult = handler(webhookData);
    processedEvents.add(webhookId);

    // FIX: trim con cap esplicito
    if (deliveryLog.length >= MAX_LOG_SIZE) deliveryLog.splice(0, MAX_LOG_SIZE / 2);
    deliveryLog.push({ eventId: webhookId, timestamp: Date.now(), status: 'delivered' });

    if (processedEvents.size > 10000) {
      const toDelete = Array.from(processedEvents).slice(0, 5000);
      toDelete.forEach(id => processedEvents.delete(id));
    }

    result = {
      status: 'accepted', code: 200, webhookId, eventType,
      ...handlerResult,
      deliveryAttempt: (webhookData.attempt as number) ?? 1,
      totalDelivered: deliveryLog.length,
    };
  }
  const processingMs = performance.now() - tProcess;

  // ── 4. SERIALIZATION ──
  const tSerialize = performance.now();
  const responseJson = JSON.stringify(result);
  // FIX: TextEncoder invece di Blob
  const responseSizeBytes = byteLength(responseJson);
  const serializationMs = performance.now() - tSerialize;

  const totalServerMs = performance.now() - tTotal;

  return {
    id: raw.id,
    action: raw.action,
    result: responseJson,
    serverMetrics: {
      parsingMs, validationMs, processingMs, serializationMs,
      totalServerMs, requestSizeBytes, responseSizeBytes,
      // FIX: rimossa la contaminazione da processedEvents.size
      memoryUsedKB: 0,
    },
    timestamp: Date.now(),
  };
}

self.onmessage = (e: MessageEvent<IncomingRequest>) => {
  self.postMessage(handleRequestAPI(e.data));
};