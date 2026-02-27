export type ProtocolType = 'REST' | 'GraphQL' | 'gRPC' | 'SOAP' | 'MQTT' | 'Webhooks';

// ── Worker Messages ──

export interface WorkerRequest {
  id: string;
  action: 'process' | 'ping' | 'stats';
  payload: unknown;
  payloadSizeBytes: number;
  timestamp: number;
}

export interface WorkerResponse {
  id: string;
  action: string;
  result: unknown;
  // Server-side metrics (measured inside the worker)
  serverMetrics: ServerIterationMetrics;
  timestamp: number;
}

export interface ServerIterationMetrics {
  parsingMs: number;          // time to parse incoming request
  validationMs: number;       // time to validate request
  processingMs: number;       // time to execute business logic
  serializationMs: number;    // time to serialize response
  totalServerMs: number;      // total server-side processing time
  requestSizeBytes: number;   // size of the request as received
  responseSizeBytes: number;  // size of the response generated
  memoryUsedKB: number;       // approx memory used during processing
}

// ── Client-side measurements ──

export interface ClientIterationMetrics {
  // Measured with performance.now() on client side
  payloadBuildMs: number;     // time to build protocol-specific payload
  sendMs: number;             // time from postMessage send to receive
  responseParseMs: number;    // time to parse response on client
  totalClientMs: number;      // total round-trip from client perspective
  payloadSizeBytes: number;   // bytes sent
  responseSizeBytes: number;  // bytes received
}

export interface IterationSample {
  index: number;
  client: ClientIterationMetrics;
  server: ServerIterationMetrics;
  success: boolean;
  errorMessage?: string;
  timestamp: number;
}

// ── Aggregated results ──

export interface LatencyStats {
  avg: number;
  min: number;
  max: number;
  median: number;
  p95: number;
  p99: number;
  stdDev: number;
}

export interface ProtocolResult {
  protocol: ProtocolType;
  samples: IterationSample[];

  // Client-side aggregated
  clientLatency: LatencyStats;
  clientThroughputRps: number;
  avgPayloadBuildMs: number;
  avgResponseParseMs: number;
  avgSendMs: number;
  totalClientDurationMs: number;
  totalBytesSent: number;
  totalBytesReceived: number;
  avgPayloadSizeBytes: number;
  avgResponseSizeBytes: number;

  // Server-side aggregated (from worker)
  serverLatency: LatencyStats;
  avgServerParsingMs: number;
  avgServerValidationMs: number;
  avgServerProcessingMs: number;
  avgServerSerializationMs: number;
  avgServerMemoryKB: number;
  serverThroughputRps: number;
  totalServerDurationMs: number;

  // Overall
  protocolOverheadBytes: number; // protocol envelope overhead vs raw data
  errorCount: number;
  errorRate: number;
  workerReady: boolean;
}

// ── Config ──

export interface BenchmarkConfig {
  protocols: ProtocolType[];
  iterations: number;
  payloadSize: 'tiny' | 'small' | 'medium' | 'large' | 'huge';
  concurrency: number;
  warmupIterations: number;
  delayBetweenMs: number;
}

export interface BenchmarkRun {
  id: string;
  timestamp: number;
  config: BenchmarkConfig;
  results: ProtocolResult[];
  status: 'running' | 'completed' | 'error';
  durationMs: number;
}

// ── Protocol info ──

export interface ProtocolInfo {
  name: ProtocolType;
  description: string;
  color: string;
  icon: string;
  format: string;
  transport: string;
  pros: string[];
  cons: string[];
  bestFor: string;
  serverDetails: string;
}
