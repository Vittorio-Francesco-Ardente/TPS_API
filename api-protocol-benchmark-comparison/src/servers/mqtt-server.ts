// ═══════════════════════════════════════════════════════════════
// MQTT BROKER — Web Worker (Fixed)
//
// Fix log vs original:
// - sessions e retainedMessages crescevano senza limite (memory leak).
//   Ora hanno un cap esplicito con LRU-eviction semplificata.
// - Parsing CONNECT: `pos += 6` saltava 6 byte fissi, ma lo standard
//   MQTT 3.1.1 ha lunghezze variabili (es. protocol name "MQTT" = 4 byte
//   + lunghezza 2 byte = 6, ma MQTT 3.1 usa "MQIsdp" = 6 byte + 2 = 8).
//   Ora legge correttamente la lunghezza del protocol name.
// - btoa(String.fromCharCode(...packet)): stack overflow su array grandi.
//   Ora usa chunk-based encoding.
// - requestSizeBytes misurava i byte decodificati ma dopo il try/catch,
//   poteva restare 0 se atob falliva. Ora è sempre coerente.
// - memoryUsedKB: moltiplicazione arbitraria con processedEvents.size
//   che contaminava le metriche con stato cumulato. Rimossa.
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

const PACKET_TYPES = {
  CONNECT: 1, CONNACK: 2, PUBLISH: 3, PUBACK: 4,
  SUBSCRIBE: 8, SUBACK: 9, PINGREQ: 12, PINGRESP: 13,
} as const;

// FIX: cap a 1000 sessioni per evitare memory leak
const MAX_SESSIONS = 1000;
const sessions: Map<string, { clientId: string; subscriptions: string[]; connected: boolean }> = new Map();
const retainedMessages: Map<string, { topic: string; payload: Uint8Array; qos: number }> = new Map();

function evictIfNeeded<K, V>(map: Map<K, V>, max: number): void {
  if (map.size >= max) {
    const first = map.keys().next().value;
    if (first !== undefined) map.delete(first);
  }
}

// FIX: no stack overflow su payload grandi
function uint8ToBase64API(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function parseMQTTPacket(data: Uint8Array): {
  type: number; flags: number; remainingLength: number;
  topic?: string; payload?: Uint8Array; qos?: number;
  packetId?: number; clientId?: string;
} {
  if (data.length < 2) return { type: 0, flags: 0, remainingLength: 0 };

  const byte1 = data[0];
  const type = (byte1 >> 4) & 0x0f;
  const flags = byte1 & 0x0f;

  let remainingLength = 0;
  let multiplier = 1;
  let pos = 1;
  while (pos < data.length) {
    const encodedByte = data[pos++];
    remainingLength += (encodedByte & 127) * multiplier;
    if ((encodedByte & 128) === 0) break;
    multiplier *= 128;
  }

  const result: ReturnType<typeof parseMQTTPacket> = { type, flags, remainingLength };

  if (type === PACKET_TYPES.PUBLISH) {
    if (pos + 2 <= data.length) {
      const topicLen = (data[pos] << 8) | data[pos + 1];
      pos += 2;
      result.topic = new TextDecoder().decode(data.slice(pos, pos + topicLen));
      pos += topicLen;
      result.qos = (flags >> 1) & 0x03;
      if (result.qos > 0 && pos + 2 <= data.length) {
        result.packetId = (data[pos] << 8) | data[pos + 1];
        pos += 2;
      }
      result.payload = data.slice(pos);
    }
  } else if (type === PACKET_TYPES.CONNECT) {
    // FIX: legge la lunghezza del protocol name dinamicamente
    // invece di saltare 6 byte fissi (non funzionava con MQTT 3.1 "MQIsdp")
    if (pos + 2 <= data.length) {
      const protoNameLen = (data[pos] << 8) | data[pos + 1];
      pos += 2 + protoNameLen; // skip protocol name
      pos += 1; // protocol level
      pos += 1; // connect flags
      pos += 2; // keep alive
      if (pos + 2 <= data.length) {
        const clientIdLen = (data[pos] << 8) | data[pos + 1];
        pos += 2;
        result.clientId = new TextDecoder().decode(data.slice(pos, pos + clientIdLen));
      }
    }
  }

  return result;
}

function buildMQTTResponse(packetType: number, packetId: number, payload?: Uint8Array): Uint8Array {
  const parts: number[] = [];
  switch (packetType) {
    case PACKET_TYPES.CONNACK:
      parts.push(0x20, 0x02, 0x00, 0x00);
      break;
    case PACKET_TYPES.PUBACK:
      parts.push(0x40, 0x02, (packetId >> 8) & 0xff, packetId & 0xff);
      break;
    case PACKET_TYPES.SUBACK:
      parts.push(0x90, 0x03, (packetId >> 8) & 0xff, packetId & 0xff, 0x00);
      break;
    case PACKET_TYPES.PINGRESP:
      parts.push(0xd0, 0x00);
      break;
    case PACKET_TYPES.PUBLISH: {
      const topicBytes = new TextEncoder().encode('benchmark/response');
      const payloadBytes = payload ?? new Uint8Array(0);
      const totalLen = 2 + topicBytes.length + payloadBytes.length;
      parts.push(0x30);
      let len = totalLen;
      while (len > 127) { parts.push((len & 0x7f) | 0x80); len = Math.floor(len / 128); }
      parts.push(len & 0x7f);
      parts.push((topicBytes.length >> 8) & 0xff, topicBytes.length & 0xff);
      parts.push(...topicBytes, ...payloadBytes);
      break;
    }
  }
  return new Uint8Array(parts);
}

function handleRequestAPI(raw: IncomingRequest): ServerResponse {
  const tTotal = performance.now();

  // ── 1. PARSING ──
  const tParse = performance.now();
  let binaryData: Uint8Array;
  try {
    const binaryStr = atob(raw.payload);
    binaryData = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) binaryData[i] = binaryStr.charCodeAt(i);
  } catch {
    binaryData = new Uint8Array(0);
  }
  const requestSizeBytes = binaryData.length;
  const packet = parseMQTTPacket(binaryData);
  const parsingMs = performance.now() - tParse;

  // ── 2. VALIDATION ──
  const tValidate = performance.now();
  const isValidType = packet.type >= 1 && packet.type <= 14;
  const isValidLength = packet.remainingLength >= 0;
  if (packet.topic) {
    void (!packet.topic.includes('#') || packet.topic.endsWith('#'));
  }
  const validationMs = performance.now() - tValidate;

  // ── 3. PROCESSING ──
  const tProcess = performance.now();
  let responsePacket: Uint8Array;

  if (!isValidType || !isValidLength) {
    responsePacket = buildMQTTResponse(PACKET_TYPES.CONNACK, 0);
  } else {
    switch (packet.type) {
      case PACKET_TYPES.CONNECT: {
        const clientId = packet.clientId ?? 'anonymous';
        // FIX: evict se necessario prima di inserire
        evictIfNeeded(sessions, MAX_SESSIONS);
        sessions.set(clientId, { clientId, subscriptions: [], connected: true });
        responsePacket = buildMQTTResponse(PACKET_TYPES.CONNACK, 0);
        break;
      }
      case PACKET_TYPES.PUBLISH: {
        if (packet.topic && packet.payload) {
          evictIfNeeded(retainedMessages, MAX_SESSIONS);
          retainedMessages.set(packet.topic, {
            topic: packet.topic, payload: packet.payload, qos: packet.qos ?? 0,
          });
        }
        if ((packet.qos ?? 0) >= 1) {
          responsePacket = buildMQTTResponse(PACKET_TYPES.PUBACK, packet.packetId ?? 0);
        } else {
          const responsePayload = new TextEncoder().encode(JSON.stringify({
            status: 'published', topic: packet.topic,
            payloadSize: packet.payload?.length ?? 0, timestamp: Date.now(),
          }));
          responsePacket = buildMQTTResponse(PACKET_TYPES.PUBLISH, 0, responsePayload);
        }
        break;
      }
      case PACKET_TYPES.SUBSCRIBE:
        responsePacket = buildMQTTResponse(PACKET_TYPES.SUBACK, packet.packetId ?? 0);
        break;
      case PACKET_TYPES.PINGREQ:
        responsePacket = buildMQTTResponse(PACKET_TYPES.PINGRESP, 0);
        break;
      default:
        responsePacket = buildMQTTResponse(PACKET_TYPES.CONNACK, 0);
    }
  }
  const processingMs = performance.now() - tProcess;

  // ── 4. SERIALIZATION ──
  const tSerialize = performance.now();
  // FIX: chunk-based, no stack overflow
  const responseBase64 = uint8ToBase64API(responsePacket);
  const responseSizeBytes = responsePacket.length;
  const serializationMs = performance.now() - tSerialize;

  const totalServerMs = performance.now() - tTotal;

  return {
    id: raw.id,
    action: raw.action,
    result: responseBase64,
    serverMetrics: {
      parsingMs, validationMs, processingMs, serializationMs,
      totalServerMs, requestSizeBytes, responseSizeBytes,
      memoryUsedKB: 0, // FIX: rimossa la contaminazione da stato cumulato
    },
    timestamp: Date.now(),
  };
}

self.onmessage = (e: MessageEvent<IncomingRequest>) => {
  self.postMessage(handleRequestAPI(e.data));
};