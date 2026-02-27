import type {
  ProtocolType,
  BenchmarkConfig,
  ProtocolResult,
  IterationSample,
  ClientIterationMetrics,
  ServerIterationMetrics,
  LatencyStats,
} from '../types/benchmark';

import RestServerUrl from '../servers/rest-server.ts?worker&url';
import GraphqlServerUrl from '../servers/graphql-server.ts?worker&url';
import GrpcServerUrl from '../servers/grpc-server.ts?worker&url';
import SoapServerUrl from '../servers/soap-server.ts?worker&url';
import MqttServerUrl from '../servers/mqtt-server.ts?worker&url';
import WebhookServerUrl from '../servers/webhook-server.ts?worker&url';

// ══════════════════════════════════════════════════════════════
// PAYLOAD SIZES
// ══════════════════════════════════════════════════════════════

const PAYLOAD_SIZES: Record<string, number> = {
  tiny: 16,
  small: 64,
  medium: 1024,
  large: 8192,
  huge: 65536,
};

// ══════════════════════════════════════════════════════════════
// PROTOCOL-SPECIFIC PAYLOAD BUILDERS (Client-side)
// Each builds the REAL format that the corresponding server expects
// ══════════════════════════════════════════════════════════════

function generateBaseData(size: number): Record<string, unknown> {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'benchmark_request',
    data: 'x'.repeat(Math.max(0, size - 80)),
  };
}

function buildRESTPayload(size: number): string {
  return JSON.stringify(generateBaseData(size));
}

function buildGraphQLPayload(size: number): string {
  const data = generateBaseData(size);
  return JSON.stringify({
    query: `mutation RunBenchmark($input: BenchmarkInput!) { runBenchmark(input: $input) { id status processedLength timestamp } }`,
    variables: { input: data },
    operationName: 'RunBenchmark',
  });
}

function buildGRPCPayload(size: number): string {
  const data = generateBaseData(size);
  const jsonStr = JSON.stringify(data);
  // Encode to simulated protobuf binary
  const encoder = new TextEncoder();
  const fields: number[] = [];
  // Field 1: id (string, field tag)
  const idBytes = encoder.encode(data.id as string);
  fields.push(0x0a, idBytes.length, ...idBytes); // tag=1, wire=2
  // Field 2: timestamp (varint)
  fields.push(0x10); // tag=2, wire=0
  let ts = (data.timestamp as number) & 0x7fffffff;
  while (ts > 127) { fields.push((ts & 0x7f) | 0x80); ts >>>= 7; }
  fields.push(ts & 0x7f);
  // Field 3: data (string)
  const dataBytes = encoder.encode((data.data as string) ?? '');
  fields.push(0x1a); // tag=3, wire=2
  let dl = dataBytes.length;
  while (dl > 127) { fields.push((dl & 0x7f) | 0x80); dl >>>= 7; }
  fields.push(dl & 0x7f);
  fields.push(...dataBytes);
  // gRPC frame: 1 byte compression + 4 bytes length
  const msgLen = fields.length;
  const frame = [0, (msgLen >> 24) & 0xff, (msgLen >> 16) & 0xff, (msgLen >> 8) & 0xff, msgLen & 0xff, ...fields];
  void jsonStr; // used for size reference
  return btoa(String.fromCharCode(...frame));
}

function buildSOAPPayload(size: number): string {
  const data = generateBaseData(size);
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:bench="http://benchmark.example.com/v1">
  <soap:Header>
    <bench:RequestId>${data.id}</bench:RequestId>
    <bench:Timestamp>${data.timestamp}</bench:Timestamp>
  </soap:Header>
  <soap:Body>
    <bench:BenchmarkRequest>
      <bench:Type>${data.type}</bench:Type>
      <bench:Data>${data.data}</bench:Data>
    </bench:BenchmarkRequest>
  </soap:Body>
</soap:Envelope>`;
}

function buildMQTTPayload(size: number): string {
  const data = generateBaseData(size);
  const payloadJson = JSON.stringify(data);
  const payloadBytes = new TextEncoder().encode(payloadJson);
  const topic = 'benchmark/test';
  const topicBytes = new TextEncoder().encode(topic);

  // Build MQTT PUBLISH packet
  const packet: number[] = [];
  // Fixed header: PUBLISH, QoS 0
  packet.push(0x30);
  // Remaining length
  const remainingLen = 2 + topicBytes.length + payloadBytes.length;
  let rl = remainingLen;
  while (rl > 127) { packet.push((rl & 0x7f) | 0x80); rl = Math.floor(rl / 128); }
  packet.push(rl & 0x7f);
  // Topic
  packet.push((topicBytes.length >> 8) & 0xff, topicBytes.length & 0xff);
  packet.push(...topicBytes);
  // Payload
  packet.push(...payloadBytes);

  return btoa(String.fromCharCode(...packet));
}

function buildWebhookPayload(size: number): string {
  const data = generateBaseData(size);
  return JSON.stringify({
    ...data,
    event: 'benchmark.test',
    webhook_id: crypto.randomUUID(),
    attempt: 1,
    _headers: {
      'X-Webhook-ID': crypto.randomUUID(),
      'X-Webhook-Signature': 'sha256=' + 'a'.repeat(64),
      'X-Webhook-Timestamp': String(Date.now()),
    },
  });
}

const PAYLOAD_BUILDERS: Record<ProtocolType, (size: number) => string> = {
  REST: buildRESTPayload,
  GraphQL: buildGraphQLPayload,
  gRPC: buildGRPCPayload,
  SOAP: buildSOAPPayload,
  MQTT: buildMQTTPayload,
  Webhooks: buildWebhookPayload,
};

// Protocol overhead in bytes (headers/envelope not part of actual data)
const PROTOCOL_OVERHEAD: Record<ProtocolType, number> = {
  REST: 300,      // HTTP headers
  GraphQL: 380,   // HTTP headers + query wrapper
  gRPC: 105,      // HTTP/2 frame + gRPC header
  SOAP: 800,      // XML envelope + SOAP headers
  MQTT: 24,       // Fixed header + topic
  Webhooks: 450,  // HTTP headers + signature headers
};

// ══════════════════════════════════════════════════════════════
// WORKER MANAGEMENT
// ══════════════════════════════════════════════════════════════

const WORKER_URLS: Record<ProtocolType, string> = {
  REST: RestServerUrl,
  GraphQL: GraphqlServerUrl,
  gRPC: GrpcServerUrl,
  SOAP: SoapServerUrl,
  MQTT: MqttServerUrl,
  Webhooks: WebhookServerUrl,
};

function createWorker(protocol: ProtocolType): Worker {
  return new Worker(WORKER_URLS[protocol], { type: 'module' });
}

function sendToWorker(worker: Worker, payload: string, action: string): Promise<{
  serverMetrics: ServerIterationMetrics;
  responsePayload: string;
}> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timeout = setTimeout(() => {
      reject(new Error('Worker timeout'));
    }, 10000);

    const handler = (e: MessageEvent) => {
      if (e.data.id === id) {
        clearTimeout(timeout);
        worker.removeEventListener('message', handler);
        resolve({
          serverMetrics: e.data.serverMetrics,
          responsePayload: e.data.result,
        });
      }
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ id, action, payload, timestamp: Date.now() });
  });
}

// ══════════════════════════════════════════════════════════════
// SINGLE ITERATION — measures REAL client + server timings
// ══════════════════════════════════════════════════════════════

async function runIteration(
  worker: Worker,
  protocol: ProtocolType,
  payloadSize: number,
  iterIndex: number,
): Promise<IterationSample> {
  const builder = PAYLOAD_BUILDERS[protocol];

  // 1. CLIENT: Build protocol-specific payload
  const tBuild = performance.now();
  const payload = builder(payloadSize);
  const payloadBuildMs = performance.now() - tBuild;
  const payloadSizeBytes = new Blob([payload]).size;

  // 2. CLIENT → SERVER: Send to worker and wait for response
  const tSend = performance.now();
  let serverMetrics: ServerIterationMetrics;
  let responsePayload: string;
  let success = true;
  let errorMessage: string | undefined;

  try {
    const result = await sendToWorker(worker, payload, 'process');
    serverMetrics = result.serverMetrics;
    responsePayload = result.responsePayload;
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : 'Unknown error';
    serverMetrics = {
      parsingMs: 0, validationMs: 0, processingMs: 0, serializationMs: 0,
      totalServerMs: 0, requestSizeBytes: payloadSizeBytes, responseSizeBytes: 0, memoryUsedKB: 0,
    };
    responsePayload = '';
  }
  const sendMs = performance.now() - tSend;

  // 3. CLIENT: Parse response
  const tParse = performance.now();
  const responseSizeBytes = new Blob([responsePayload]).size;
  if (responsePayload) {
    try {
      if (protocol === 'SOAP') {
        new DOMParser().parseFromString(responsePayload, 'text/xml');
      } else if (protocol === 'gRPC' || protocol === 'MQTT') {
        // Decode base64 binary
        const binary = atob(responsePayload);
        let _checksum = 0;
        for (let i = 0; i < binary.length; i++) _checksum += binary.charCodeAt(i);
        void _checksum;
      } else {
        JSON.parse(responsePayload);
      }
    } catch {
      // Parse failed — still measured the time
    }
  }
  const responseParseMs = performance.now() - tParse;

  const totalClientMs = payloadBuildMs + sendMs + responseParseMs;

  const client: ClientIterationMetrics = {
    payloadBuildMs,
    sendMs,
    responseParseMs,
    totalClientMs,
    payloadSizeBytes,
    responseSizeBytes,
  };

  return {
    index: iterIndex,
    client,
    server: serverMetrics,
    success,
    errorMessage,
    timestamp: Date.now(),
  };
}

// ══════════════════════════════════════════════════════════════
// STATISTICS
// ══════════════════════════════════════════════════════════════

function computeLatencyStats(values: number[]): LatencyStats {
  if (values.length === 0) return { avg: 0, min: 0, max: 0, median: 0, p95: 0, p99: 0, stdDev: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / Math.max(1, values.length - 1);
  return {
    avg: r(avg),
    min: r(sorted[0]),
    max: r(sorted[sorted.length - 1]),
    median: r(sorted[Math.floor(sorted.length * 0.5)]),
    p95: r(sorted[Math.floor(sorted.length * 0.95)]),
    p99: r(sorted[Math.floor(sorted.length * 0.99)]),
    stdDev: r(Math.sqrt(variance)),
  };
}

function r(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function aggregateResults(protocol: ProtocolType, samples: IterationSample[], totalDurationMs: number): ProtocolResult {
  const clientLatencies = samples.map(s => s.client.totalClientMs);
  const serverLatencies = samples.map(s => s.server.totalServerMs);

  const clientLatency = computeLatencyStats(clientLatencies);
  const serverLatency = computeLatencyStats(serverLatencies);

  const totalBytesSent = samples.reduce((s, x) => s + x.client.payloadSizeBytes, 0);
  const totalBytesReceived = samples.reduce((s, x) => s + x.client.responseSizeBytes, 0);
  const errorCount = samples.filter(s => !s.success).length;

  const totalServerDuration = samples.reduce((s, x) => s + x.server.totalServerMs, 0);

  return {
    protocol,
    samples,
    clientLatency,
    clientThroughputRps: r(totalDurationMs > 0 ? (samples.length / (totalDurationMs / 1000)) : 0),
    avgPayloadBuildMs: r(samples.reduce((s, x) => s + x.client.payloadBuildMs, 0) / samples.length),
    avgResponseParseMs: r(samples.reduce((s, x) => s + x.client.responseParseMs, 0) / samples.length),
    avgSendMs: r(samples.reduce((s, x) => s + x.client.sendMs, 0) / samples.length),
    totalClientDurationMs: r(totalDurationMs),
    totalBytesSent,
    totalBytesReceived,
    avgPayloadSizeBytes: r(totalBytesSent / samples.length),
    avgResponseSizeBytes: r(totalBytesReceived / samples.length),
    serverLatency,
    avgServerParsingMs: r(samples.reduce((s, x) => s + x.server.parsingMs, 0) / samples.length),
    avgServerValidationMs: r(samples.reduce((s, x) => s + x.server.validationMs, 0) / samples.length),
    avgServerProcessingMs: r(samples.reduce((s, x) => s + x.server.processingMs, 0) / samples.length),
    avgServerSerializationMs: r(samples.reduce((s, x) => s + x.server.serializationMs, 0) / samples.length),
    avgServerMemoryKB: r(samples.reduce((s, x) => s + x.server.memoryUsedKB, 0) / samples.length),
    serverThroughputRps: r(totalServerDuration > 0 ? (samples.length / (totalServerDuration / 1000)) : 0),
    totalServerDurationMs: r(totalServerDuration),
    protocolOverheadBytes: PROTOCOL_OVERHEAD[protocol],
    errorCount,
    errorRate: r((errorCount / samples.length) * 100),
    workerReady: true,
  };
}

// ══════════════════════════════════════════════════════════════
// MAIN BENCHMARK RUNNER
// ══════════════════════════════════════════════════════════════

export type ProgressCallback = (
  overallPercent: number,
  currentProtocol: ProtocolType,
  protocolPercent: number,
  partialResults: ProtocolResult[],
) => void;

export async function runFullBenchmark(
  config: BenchmarkConfig,
  onProgress: ProgressCallback,
): Promise<ProtocolResult[]> {
  const results: ProtocolResult[] = [];
  const payloadSize = PAYLOAD_SIZES[config.payloadSize];
  const totalProtocols = config.protocols.length;

  for (let pi = 0; pi < totalProtocols; pi++) {
    const protocol = config.protocols[pi];
    const worker = createWorker(protocol);

    // Wait for worker to be ready
    await new Promise(resolve => setTimeout(resolve, 50));

    // Warmup
    for (let w = 0; w < config.warmupIterations; w++) {
      try {
        await runIteration(worker, protocol, payloadSize, -1);
      } catch {
        // warmup errors are OK
      }
    }

    const allSamples: IterationSample[] = [];
    const tStart = performance.now();
    const totalIterations = config.iterations;
    const batchSize = config.concurrency;
    const numBatches = Math.ceil(totalIterations / batchSize);

    for (let b = 0; b < numBatches; b++) {
      const currentBatchSize = Math.min(batchSize, totalIterations - b * batchSize);

      const batchPromises = Array.from({ length: currentBatchSize }, (_, i) =>
        runIteration(worker, protocol, payloadSize, b * batchSize + i)
      );
      const batchResults = await Promise.all(batchPromises);
      allSamples.push(...batchResults);

      // Progress
      const protocolPct = ((b + 1) / numBatches) * 100;
      const overallPct = ((pi + protocolPct / 100) / totalProtocols) * 100;
      onProgress(overallPct, protocol, protocolPct, results);

      // Delay between batches
      if (config.delayBetweenMs > 0) {
        await new Promise(resolve => setTimeout(resolve, config.delayBetweenMs));
      } else {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    const totalDuration = performance.now() - tStart;
    const result = aggregateResults(protocol, allSamples, totalDuration);
    results.push(result);

    // Terminate worker
    worker.terminate();

    onProgress(((pi + 1) / totalProtocols) * 100, protocol, 100, [...results]);
  }

  return results;
}
