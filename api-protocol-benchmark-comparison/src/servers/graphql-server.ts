// ═══════════════════════════════════════════════════════════════
// GraphQL SERVER — Web Worker (Fixed)
//
// Fix log vs original:
// - new Blob([raw.payload]).size nel parsing step: Blob ha overhead
//   di allocazione che inquina parsingMs. Ora usa TextEncoder.
// - extensions.complexity usava query.length (lunghezza stringa)
//   come proxy per complessità — non ha senso semantico.
//   Ora conta i field selector reali nel query.
// - crypto.randomUUID() rimosso dal path critico (benchmark query):
//   l'id viene estratto dalle variabili o dal raw.id.
// - new Blob() per responseSizeBytes: stessa issue del parsing.
//   Ora usa TextEncoder.encode().length.
// - memoryUsedKB: moltiplicazione arbitraria (* 3.5). Rimossa.
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

// FIX: misurazione byte corretta, senza overhead Blob
function byteLength(s: string): number {
  return encoder.encode(s).length;
}

const schema = {
  types: {
    BenchmarkResult: { id: 'ID!', status: 'String!', processedLength: 'Int!', timestamp: 'Float!' },
    Query: { benchmark: 'BenchmarkResult' },
    Mutation: { runBenchmark: 'BenchmarkResult' },
  },
  resolvers: {
    runBenchmark: (variables: Record<string, unknown>, requestId: string) => {
      const input = (variables.input ?? variables) as Record<string, unknown>;
      const data = (input.data as string) ?? '';
      return {
        // FIX: id viene dall'esterno, non generato nel path critico
        id: (input.id as string) ?? requestId,
        status: 'processed',
        processedLength: data.length,
        timestamp: Date.now(),
      };
    },
    benchmark: (requestId: string) => ({
      id: requestId,
      status: 'ready',
      processedLength: 0,
      timestamp: Date.now(),
    }),
  },
};

function parseGraphQLQuery(body: string): {
  query: string;
  variables: Record<string, unknown>;
  operationName?: string;
} {
  const parsed = JSON.parse(body);
  return {
    query: parsed.query ?? '',
    variables: parsed.variables ?? {},
    operationName: parsed.operationName,
  };
}

function validateQuery(query: string): {
  valid: boolean;
  isMutation: boolean;
  operationName: string;
  fieldCount: number; // FIX: metrica semantica reale
} {
  const trimmed = query.trim();
  const isMutation = trimmed.startsWith('mutation');
  const nameMatch = query.match(/(?:query|mutation)\s+(\w+)/);
  const operationName = nameMatch?.[1] ?? 'anonymous';

  // Conta i field selector — approssimazione della complessità reale
  const fieldMatches = query.match(/\b(\w+)\s*(?:\([^)]*\))?\s*\{/g);
  const fieldCount = fieldMatches ? fieldMatches.length : 0;

  const valid = /\{[\s\S]+\}/.test(query);

  return { valid, isMutation, operationName, fieldCount };
}

function handleRequest(raw: IncomingRequest): ServerResponse {
  const tTotal = performance.now();

  // ── 1. PARSING ──
  const tParse = performance.now();
  // FIX: TextEncoder invece di Blob per non inquinare parsingMs
  const requestSizeBytes = byteLength(raw.payload);
  let gqlRequest: { query: string; variables: Record<string, unknown>; operationName?: string };
  try {
    gqlRequest = parseGraphQLQuery(raw.payload);
  } catch {
    gqlRequest = { query: '', variables: {} };
  }
  const parsingMs = performance.now() - tParse;

  // ── 2. VALIDATION ──
  const tValidate = performance.now();
  const validation = validateQuery(gqlRequest.query);
  void (typeof gqlRequest.variables === 'object');
  const validationMs = performance.now() - tValidate;

  // ── 3. PROCESSING ──
  const tProcess = performance.now();
  let responseData: Record<string, unknown>;
  if (!validation.valid) {
    responseData = {
      data: null,
      errors: [{
        message: 'Syntax Error: Expected Name, found }',
        locations: [{ line: 1, column: 1 }],
        extensions: { code: 'GRAPHQL_PARSE_FAILED' },
      }],
    };
  } else {
    const result = validation.isMutation
      ? schema.resolvers.runBenchmark(gqlRequest.variables, raw.id)
      : schema.resolvers.benchmark(raw.id);
    const fieldName = validation.isMutation ? 'runBenchmark' : 'benchmark';
    responseData = {
      data: { [fieldName]: result },
      errors: null,
      extensions: {
        // FIX: fieldCount è una metrica semanticamente significativa
        fieldCount: validation.fieldCount,
        operationName: validation.operationName,
      },
    };
  }
  const processingMs = performance.now() - tProcess;

  // ── 4. SERIALIZATION ──
  const tSerialize = performance.now();
  const responseJson = JSON.stringify(responseData);
  // FIX: TextEncoder invece di Blob
  const responseSizeBytes = byteLength(responseJson);
  const serializationMs = performance.now() - tSerialize;

  const totalServerMs = performance.now() - tTotal;

  return {
    id: raw.id,
    action: raw.action,
    result: responseJson,
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
  self.postMessage(handleRequest(e.data));
};

export {};