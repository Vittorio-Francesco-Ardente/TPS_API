import type {
  ProtocolType,
  BenchmarkConfig,
  ProtocolMetrics,
} from '../types/benchmark';

const BENCHMARK_SERVER = 'http://localhost:3005';

const BASE: Record<'REST' | 'GraphQL' | 'gRPC' | 'SOAP', string> = {
  REST:    'http://localhost:3001',
  GraphQL: 'http://localhost:3002',
  gRPC:    'http://localhost:3004',
  SOAP:    'http://localhost:3006',
};

export type ProgressCallback = (
  overallPercent:  number,
  currentProtocol: ProtocolType,
  protocolPercent: number,
  partialResults:  ProtocolMetrics[],
) => void;

export async function runFullBenchmark(
  config: BenchmarkConfig,
  onProgress: ProgressCallback,
): Promise<ProtocolMetrics[]> {

  const firstProto = config.protocols[0] as ProtocolType;
  onProgress(0, firstProto, 0, []);

  // Niente AbortSignal — il benchmark può durare minuti, non lo interrompiamo
  let res: Response;
  try {
    res = await fetch(`${BENCHMARK_SERVER}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        protocols:   config.protocols,
        iterations:  config.iterations,
        payloadSize: config.payloadSize,
        concurrency: config.concurrency,
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Benchmark server non raggiungibile (porta 3005): ${msg}`);
  }

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errMsg = body.error ?? errMsg;
    } catch { /* ignora */ }
    throw new Error(`Benchmark server error: ${errMsg}`);
  }

  let data: { results: ProtocolMetrics[] };
  try {
    data = await res.json();
  } catch (err) {
    throw new Error('Risposta del benchmark server non valida (JSON parse error)');
  }

  const results = data.results ?? [];

  results.forEach((r, i) => {
    onProgress(
      ((i + 1) / results.length) * 100,
      r.protocol as ProtocolType,
      100,
      results.slice(0, i + 1),
    );
  });

  return results;
}

export async function checkServersOnline(): Promise<Record<'REST' | 'GraphQL' | 'gRPC' | 'SOAP' | 'Benchmark', boolean>> {
  const out = { REST: false, GraphQL: false, gRPC: false, SOAP: false, Benchmark: false };
  const checks: [keyof typeof out, string][] = [
    ['REST',      `${BASE.REST}/health`],
    ['GraphQL',   `${BASE.GraphQL}/health`],
    ['gRPC',      `${BASE.gRPC}/health`],
    ['SOAP',      `${BASE.SOAP}/health`],
    ['Benchmark', `${BENCHMARK_SERVER}/health`],
  ];
  await Promise.all(
    checks.map(async ([key, url]) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
        out[key] = res.ok;
      } catch { out[key] = false; }
    })
  );
  return out;
}
