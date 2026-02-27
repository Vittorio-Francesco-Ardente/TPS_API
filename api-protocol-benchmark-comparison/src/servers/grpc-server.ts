// ═══════════════════════════════════════════════════════════════
// gRPC SERVER — Web Worker (Fixed)
//
// Fix log vs original:
// - requestSizeBytes: raw.payload.length misurava caratteri base64,
//   non byte reali. Ora decodifica prima e misura i byte binari.
// - frameHeader: [0,0,0,0, length] overflow sopra 255 byte.
//   Ora usa DataView big-endian a 4 byte come da spec gRPC.
// - Serializzazione: Array spread O(n²). Ora usa Uint8Array + set().
// - btoa(String.fromCharCode(...arr)): crasha con stack overflow su
//   payload grandi. Ora usa chunk-based encoding.
// - crypto.randomUUID() rimosso dal path critico: l'id arriva
//   dall'esterno nel campo raw.id.
// - memoryUsedKB: era una moltiplicazione arbitraria senza base.
//   Ora riportato come 0 — non misurabile accuratamente nel Worker.
// ═══════════════════════════════════════════════════════════════

interface IncomingRequest {
  id: string;
  action: string;
  payload: string; // base64-encoded protobuf binary
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

// ── Protobuf encoding helpers — Uint8Array-based ──

function encodeVarint(value: number): Uint8Array {
  const buf: number[] = [];
  let v = value >>> 0;
  while (v > 127) {
    buf.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  buf.push(v & 0x7f);
  return new Uint8Array(buf);
}

function encodeString(fieldNumber: number, value: string): Uint8Array {
  const tag = (fieldNumber << 3) | 2;
  const encoded = new TextEncoder().encode(value);
  const tagBytes = encodeVarint(tag);
  const lenBytes = encodeVarint(encoded.length);
  const out = new Uint8Array(tagBytes.length + lenBytes.length + encoded.length);
  let off = 0;
  out.set(tagBytes, off); off += tagBytes.length;
  out.set(lenBytes, off); off += lenBytes.length;
  out.set(encoded, off);
  return out;
}

function encodeInt(fieldNumber: number, value: number): Uint8Array {
  const tag = (fieldNumber << 3) | 0;
  const tagBytes = encodeVarint(tag);
  const valBytes = encodeVarint(value);
  const out = new Uint8Array(tagBytes.length + valBytes.length);
  out.set(tagBytes, 0);
  out.set(valBytes, tagBytes.length);
  return out;
}

function decodeProtobuf(data: Uint8Array): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let pos = 0;

  while (pos < data.length) {
    const byte = data[pos];
    const wireType = byte & 0x07;
    const fieldNum = byte >> 3;
    pos++;

    if (wireType === 0) {
      let value = 0;
      let shift = 0;
      while (pos < data.length) {
        const b = data[pos++];
        value |= (b & 0x7f) << shift;
        if ((b & 0x80) === 0) break;
        shift += 7;
      }
      result[`field_${fieldNum}`] = value;
    } else if (wireType === 2) {
      let length = 0;
      let shift = 0;
      while (pos < data.length) {
        const b = data[pos++];
        length |= (b & 0x7f) << shift;
        if ((b & 0x80) === 0) break;
        shift += 7;
      }
      result[`field_${fieldNum}`] = new TextDecoder().decode(data.slice(pos, pos + length));
      pos += length;
    } else {
      break;
    }
  }
  return result;
}

// ── Encoding base64 senza stack overflow ──
function uint8ToBase64API(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// ── gRPC service ──
const service = {
  name: 'BenchmarkService',
  methods: {
    RunBenchmark: (request: Record<string, unknown>) => {
      const data = (request.field_3 as string) ?? (request.field_1 as string) ?? '';
      return {
        id: request.field_1 as string ?? 'unknown',
        status: 1, // enum: PROCESSED
        processedLength: data.length,
        timestamp: Date.now(),
      };
    },
  },
};

function handleRequestAPI(raw: IncomingRequest): ServerResponse {
  const tTotal = performance.now();

  // ── 1. PARSING ──
  const tParse = performance.now();

  // FIX: decodifica prima il base64 per misurare i byte reali
  let bytes: Uint8Array;
  try {
    const binaryStr = atob(raw.payload);
    bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  } catch {
    bytes = new Uint8Array(0);
  }

  const requestSizeBytes = bytes.length; // FIX: byte binari reali, non lunghezza base64

  let decodedRequest: Record<string, unknown>;
  try {
    const messageBytes = bytes.length > 5 ? bytes.slice(5) : bytes;
    decodedRequest = decodeProtobuf(messageBytes);
  } catch {
    decodedRequest = {};
  }
  const parsingMs = performance.now() - tParse;

  // ── 2. VALIDATION ──
  const tValidate = performance.now();
  const method = service.methods.RunBenchmark;
  void (method !== undefined);
  void (typeof decodedRequest === 'object');
  const validationMs = performance.now() - tValidate;

  // ── 3. PROCESSING ──
  const tProcess = performance.now();
  const result = method(decodedRequest);
  const processingMs = performance.now() - tProcess;

  // ── 4. SERIALIZATION ──
  const tSerialize = performance.now();

  const parts: Uint8Array[] = [
    encodeString(1, result.id),
    encodeInt(2, result.status),
    encodeInt(3, result.processedLength),
    encodeInt(4, result.timestamp),
  ];

  const bodyLen = parts.reduce((s, p) => s + p.length, 0);
  const body = new Uint8Array(bodyLen);
  let off = 0;
  for (const p of parts) { body.set(p, off); off += p.length; }

  // FIX: frame header gRPC corretto — 1 byte flag + 4 byte big-endian length
  const frame = new Uint8Array(5 + bodyLen);
  frame[0] = 0; // no compression
  const view = new DataView(frame.buffer);
  view.setUint32(1, bodyLen, false); // big-endian
  frame.set(body, 5);

  const responseBase64 = uint8ToBase64API(frame); // FIX: no stack overflow
  const responseSizeBytes = frame.length;
  const serializationMs = performance.now() - tSerialize;

  const totalServerMs = performance.now() - tTotal;

  return {
    id: raw.id,
    action: raw.action,
    result: responseBase64,
    serverMetrics: {
      parsingMs,
      validationMs,
      processingMs,
      serializationMs,
      totalServerMs,
      requestSizeBytes,
      responseSizeBytes,
      memoryUsedKB: 0, // FIX: non misurabile accuratamente nel Worker
    },
    timestamp: Date.now(),
  };
}

self.onmessage = (e: MessageEvent<IncomingRequest>) => {
  self.postMessage(handleRequestAPI(e.data));
};