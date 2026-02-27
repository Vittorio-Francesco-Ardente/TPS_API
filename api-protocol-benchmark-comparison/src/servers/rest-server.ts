// ═══════════════════════════════════════════════════════════════
// REST API SERVER — Web Worker (Fixed)
//
// Fix log vs original:
// - new Blob([raw.payload]).size nel parsing step: Blob ha overhead
//   di allocazione che inquina parsingMs. Ora usa TextEncoder.
// - new Blob([responseJson]).size stesso problema in serialization.
//   Ora usa TextEncoder.
// - crypto.randomUUID() rimosso dal path critico: l'id viene
//   estratto dal body o da raw.id.
// - estimateMemory moltiplicava per 3 in modo arbitrario.
//   Rimossa — la stima non è affidabile senza accesso a MemoryAPI.
// - _headers mock creava un oggetto inutile ad ogni request.
//   Rimosso.
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

const encoder = new TextEncoder();

function byteLength(s: string): number {
  return encoder.encode(s).length;
}

const routes: Record<string, (body: Record<string, unknown>, requestId: string) => Record<string, unknown>> = {
  // FIX: requestId arriva dall'esterno invece di crypto.randomUUID()
  'POST /api/benchmark': (body, requestId) => {
    const id = (body.id as string) ?? requestId;
    const data = (body.data as string) ?? '';
    const processed = data.toUpperCase();
    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': id,
        'X-Response-Time': Date.now(),
        'Cache-Control': 'no-cache',
      },
      body: {
        id,
        status: 'processed',
        processedLength: processed.length,
        timestamp: Date.now(),
        _links: {
          self: `/api/benchmark/${id}`,
          collection: '/api/benchmark',
        },
      },
    };
  },
  'GET /api/benchmark': (_body, _requestId) => ({
    status: 200,
    body: { items: [], total: 0, page: 1, perPage: 20 },
  }),
};

function handleRequestAPI(raw: IncomingRequest): ServerResponse {
  const tTotal = performance.now();

  // ── 1. PARSING ──
  const tParse = performance.now();
  // FIX: TextEncoder invece di Blob per non inquinare parsingMs
  const requestSizeBytes = byteLength(raw.payload);
  let parsedBody: Record<string, unknown>;
  try {
    parsedBody = JSON.parse(raw.payload);
  } catch {
    parsedBody = {};
  }
  const parsingMs = performance.now() - tParse;

  // ── 2. VALIDATION ──
  const tValidate = performance.now();
  const isValid = typeof parsedBody === 'object' && parsedBody !== null;
  // FIX: rimosso l'oggetto _headers mock inutile creato ad ogni request
  const validationMs = performance.now() - tValidate;

  // ── 3. PROCESSING ──
  const tProcess = performance.now();
  let routeResult: Record<string, unknown>;
  if (!isValid) {
    routeResult = { status: 400, body: { error: 'Bad Request', message: 'Invalid JSON' } };
  } else {
    const handler = routes['POST /api/benchmark'];
    routeResult = handler(parsedBody, raw.id);
  }
  const processingMs = performance.now() - tProcess;

  // ── 4. SERIALIZATION ──
  const tSerialize = performance.now();
  const responseJson = JSON.stringify(routeResult);
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
      memoryUsedKB: 0, // FIX: non misurabile accuratamente — rimossa stima arbitraria
    },
    timestamp: Date.now(),
  };
}

self.onmessage = (e: MessageEvent<IncomingRequest>) => {
  self.postMessage(handleRequestAPI(e.data));
};

export {};