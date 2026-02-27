// ═══════════════════════════════════════════════════════════════
// SOAP SERVER — Web Worker (Fixed)
//
// Fix log vs original:
// - DOMParser veniva chiamato DUE VOLTE: una nel parsing e una nel
//   passo di serializzazione per "validare" l'XML generato.
//   Questo raddoppiava artificialmente il parsingMs e inquinava
//   serializationMs. Ora il secondo DOMParser è rimosso.
// - hasValidEnvelope usava String.includes('soap:Envelope') che
//   dava falsi positivi su stringhe che contenevano quel testo
//   in un commento o in un payload. Ora controlla il DOM reale.
// - requestSizeBytes usava new Blob([raw.payload]).size con
//   overhead di allocazione. Ora usa TextEncoder.
// - responseSizeBytes stessa issue. Ora usa TextEncoder.
// - crypto.randomUUID() rimosso dal path critico: l'id arriva
//   dall'esterno.
// - memoryUsedKB: moltiplicazione arbitraria (* 4). Rimossa.
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

function byteLengthSoap(s: string): number {
  return encoder.encode(s).length;
}

const SOAP_NS = 'http://schemas.xmlsoap.org/soap/envelope/';

const operations: Record<string, (params: Record<string, string>, requestId: string) => Record<string, string>> = {
  BenchmarkRequest: (params, requestId) => {
    const data = params.Data ?? '';
    return {
      // FIX: id arriva dall'esterno, non generato nel path critico
      Id: params.RequestId ?? requestId,
      Status: 'PROCESSED',
      ProcessedLength: String(data.length),
      Timestamp: String(Date.now()),
    };
  },
};

function parseSOAPEnvelope(xml: string): {
  doc: Document; // FIX: ritorna il Document già parsato per riusarlo nella validazione
  header: Record<string, string>;
  body: { operation: string; params: Record<string, string> };
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const header: Record<string, string> = {};
  const headerEl = doc.getElementsByTagNameNS(SOAP_NS, 'Header')[0];
  if (headerEl) {
    for (let i = 0; i < headerEl.children.length; i++) {
      const child = headerEl.children[i];
      header[child.localName] = child.textContent ?? '';
    }
  }

  const bodyEl = doc.getElementsByTagNameNS(SOAP_NS, 'Body')[0];
  let operation = '';
  const params: Record<string, string> = {};

  if (bodyEl && bodyEl.children.length > 0) {
    const opEl = bodyEl.children[0];
    operation = opEl.localName;
    for (let i = 0; i < opEl.children.length; i++) {
      const child = opEl.children[i];
      params[child.localName] = child.textContent ?? '';
    }
  }

  return { doc, header, body: { operation, params } };
}

function buildSOAPResponse(operation: string, result: Record<string, string>, requestId: string): string {
  const resultFields = Object.entries(result)
    .map(([key, value]) => `        <bench:${key}>${escapeXml(value)}</bench:${key}>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:bench="http://benchmark.example.com/v1">
  <soap:Header>
    <bench:ResponseId>${escapeXml(requestId)}</bench:ResponseId>
    <bench:Timestamp>${Date.now()}</bench:Timestamp>
  </soap:Header>
  <soap:Body>
    <bench:${operation}Response>
${resultFields}
    </bench:${operation}Response>
  </soap:Body>
</soap:Envelope>`;
}

function buildSOAPFault(code: string, message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:${escapeXml(code)}</faultcode>
      <faultstring>${escapeXml(message)}</faultstring>
      <detail>
        <errorCode>BENCHMARK_ERROR</errorCode>
        <timestamp>${Date.now()}</timestamp>
      </detail>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function handleRequestAPI(raw: IncomingRequest): ServerResponse {
  const tTotal = performance.now();

  // ── 1. PARSING ──
  const tParse = performance.now();
  // FIX: TextEncoder invece di Blob
  const requestSizeBytes = byteLengthSoap(raw.payload);
  let envelope: ReturnType<typeof parseSOAPEnvelope>;
  let parseError = false;
  try {
    envelope = parseSOAPEnvelope(raw.payload);
  } catch {
    envelope = { doc: new DOMParser().parseFromString('<x/>', 'text/xml'), header: {}, body: { operation: '', params: {} } };
    parseError = true;
  }
  const parsingMs = performance.now() - tParse;

  // ── 2. VALIDATION ──
  const tValidate = performance.now();
  // FIX: valida tramite DOM già parsato, non con String.includes
  const envelopeEl = envelope.doc.getElementsByTagNameNS(SOAP_NS, 'Envelope')[0];
  const bodyEl = envelope.doc.getElementsByTagNameNS(SOAP_NS, 'Body')[0];
  const hasValidEnvelope = !parseError && envelopeEl !== undefined;
  const hasBody = bodyEl !== undefined;
  const operationExists = envelope.body.operation in operations;
  const isValid = hasValidEnvelope && hasBody && operationExists;
  const validationMs = performance.now() - tValidate;

  // ── 3. PROCESSING ──
  const tProcess = performance.now();
  let responseXml: string;
  if (!isValid) {
    responseXml = buildSOAPFault('Client', `Unknown operation: ${envelope.body.operation}`);
  } else {
    const handler = operations[envelope.body.operation];
    const result = handler(envelope.body.params, envelope.header.RequestId ?? raw.id);
    responseXml = buildSOAPResponse(envelope.body.operation, result, envelope.header.RequestId ?? raw.id);
  }
  const processingMs = performance.now() - tProcess;

  // ── 4. SERIALIZATION ──
  const tSerialize = performance.now();
  // FIX: rimosso il secondo DOMParser che raddoppiava il costo
  // FIX: TextEncoder invece di Blob
  const responseSizeBytes = byteLengthSoap(responseXml);
  const serializationMs = performance.now() - tSerialize;

  const totalServerMs = performance.now() - tTotal;

  return {
    id: raw.id,
    action: raw.action,
    result: responseXml,
    serverMetrics: {
      parsingMs, validationMs, processingMs, serializationMs,
      totalServerMs, requestSizeBytes, responseSizeBytes,
      memoryUsedKB: 0, // FIX: rimossa moltiplicazione arbitraria
    },
    timestamp: Date.now(),
  };
}

self.onmessage = (e: MessageEvent<IncomingRequest>) => {
  self.postMessage(handleRequestAPI(e.data));
};