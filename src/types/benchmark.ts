export type ProtocolType = 'REST' | 'GraphQL' | 'gRPC' | 'SOAP' | 'MQTT' | 'Webhooks';

// ── Resource metrics (real, from /metrics polling) ───────────────────────────

export interface ResourceStatEntry {
  peak: number;
  avg: number;
  min: number;
  samples: number;
  unit: string;
}

export interface ResourceStats {
  label: string;
  memory: ResourceStatEntry;
  cpu: ResourceStatEntry;
  samplingErrors: number;
}

// ── Aggregated benchmark result per protocol ──────────────────────────────────

export interface ProtocolMetrics {
  protocol: string;
  // Latency
  latencySamples: number[];
  meanLatencyMs: number;
  singleMeanLatencyMs: number;
  medianLatencyMs: number;
  varianceLatencyMs: number;
  deviationLatencyMs: number;
  semLatencyMs: number;
  moeLatencyMs: number;
  rmeLatencyPercent: number;
  p75LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  p999LatencyMs: number;
  // Throughput & errors
  throughput: number;
  errorCount: number;
  totaldurationMs: number;
  // Server resources
  metrics: ResourceStats;
}

// ── Config ────────────────────────────────────────────────────────────────────

export interface BenchmarkConfig {
  protocols: ProtocolType[];
  iterations: number;
  payloadSize: 'tiny' | 'small' | 'medium' | 'large' | 'huge';
  concurrency: number;
}

// ── History run ───────────────────────────────────────────────────────────────

export interface BenchmarkRun {
  id: string;
  timestamp: number;
  config: BenchmarkConfig;
  results: ProtocolMetrics[];
  status: 'running' | 'completed' | 'error';
  durationMs: number;
}

// ── Protocol info (for ProtocolCards) ────────────────────────────────────────

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
