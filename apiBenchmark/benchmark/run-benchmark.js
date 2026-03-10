/**
 * run-benchmark.js
 * Benchmark completo — REST | GraphQL | gRPC
 *
 * Struttura:
 *   Fase 1 — Benchmark REST isolato
 *              [A] GET  /health
 *              [B] GET  /api/products
 *              [C] POST /api/products  (payload piccolo  ~100 B)
 *              [D] POST /api/products  (payload medio   ~1 KB)
 *              [E] POST /api/products  (payload grande  ~10 KB)
 *
 *   Fase 2 — Benchmark GraphQL isolato
 *              [A] GET  /health
 *              [B] query products { id name price }
 *              [C] mutation createProduct  (payload piccolo  ~100 B)
 *              [D] mutation createProduct  (payload medio   ~1 KB)
 *              [E] mutation createProduct  (payload grande  ~10 KB)
 *
 *   Fase 3 — Benchmark gRPC isolato
 *              [A] RPC HealthCheck
 *              [B] RPC GetProducts
 *              [C] RPC CreateProduct  (payload piccolo  ~100 B)
 *              [D] RPC CreateProduct  (payload medio   ~1 KB)
 *              [E] RPC CreateProduct  (payload grande  ~10 KB)
 *
 *   Fase 4 — Confronto cross-protocollo su POST/CreateProduct
 *              Misura REST vs GraphQL vs gRPC sulle 3 dimensioni di payload
 *              e genera il report HTML finale.
 *
 * Payload variabile:
 *   Il campo 'description' (REST/GraphQL) e 'notes' (gRPC) sono stringhe
 *   di padding che variano la dimensione del body senza alterare la logica
 *   applicativa. I server le ignorano nel salvataggio.
 *
 * Avvio:  node servers/start-all.js  →  node benchmark/run-benchmark.js
 */

const apiBenchmark = require('api-benchmark');
const fs   = require('fs');
const path = require('path');

// fetch nativo disponibile da Node.js 18+.
// Se usi Node 16 installa node-fetch e decommentala:
// const fetch = require('node-fetch');
const _fetch = globalThis.fetch
  ?? (() => { throw new Error('Node.js 18+ richiesto per fetch nativo (oppure installa node-fetch)'); });

// ─── ENDPOINTS METRICS ────────────────────────────────────────────────────────
// /metrics è esposto dai server HTTP.
// gRPC usa il mini server HTTP sulla porta 3004 (non il transport binario gRPC).
const METRICS_URLS = {
  REST:    'http://localhost:3001/metrics',
  GraphQL: 'http://localhost:3002/metrics',
  gRPC:    'http://localhost:3004/metrics',
};

// ─── RESOURCE SAMPLER ─────────────────────────────────────────────────────────
//
// Campiona /metrics di un server in background durante il benchmark.
// Restituisce peak, avg, min di heapUsed (MB) e CPU totalPct (%).
//
// Come funziona:
//   const sampler = startSampling('REST', METRICS_URLS.REST);
//   await measure(restService, routes, options);   ← gira in parallelo
//   const stats = await sampler.stop();
//
// La CPU è già calcolata come % delta dal server (window tra due chiamate
// consecutive a /metrics) — non serve calcolare nulla qui, leggiamo cpu.totalPct.
//
// intervalMs: ogni quanto campionare (default 250ms → ~40 campioni in 10s)

function startSampling(label, metricsUrl, intervalMs = 250) {
  const memorySamples = [];
  const cpuSamples    = [];
  let   stopped       = false;
  let   errors        = 0;

  const loop = (async () => {
    while (!stopped) {
      try {
        const res  = await _fetch(metricsUrl, { signal: AbortSignal.timeout(500) });
        const data = await res.json();
        memorySamples.push(data.memory.heapUsed);
        cpuSamples.push(data.cpu.totalPct);
      } catch (_) {
        errors++;
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }
  })();

  return {
    stop: async () => {
      stopped = true;
      await loop;

      const summarize = (arr, unit) => {
        if (arr.length === 0) return { peak: null, avg: null, min: null, samples: 0, unit };
        const peak = Math.max(...arr);
        const min  = Math.min(...arr);
        const avg  = arr.reduce((a, b) => a + b, 0) / arr.length;
        return { peak: +peak.toFixed(2), avg: +avg.toFixed(2), min: +min.toFixed(2), samples: arr.length, unit };
      };

      return {
        label,
        memory: summarize(memorySamples, 'MB'),
        cpu:    summarize(cpuSamples,    '%'),
        samplingErrors: errors,
      };
    }
  };
}

// ─── STAMPA RISORSE ───────────────────────────────────────────────────────────
function printResourceStats(stats) {
  if (!stats) { console.log('  (nessun dato risorse)'); return; }
  const m   = stats.memory;
  const c   = stats.cpu;
  const err = stats.samplingErrors > 0 ? `  ⚠ ${stats.samplingErrors} errori campionamento` : '';

  console.log(`\n  📊 Risorse server [${stats.label}] durante il benchmark${err}`);

  if (m.samples > 0) {
    console.log(`     🧠 Heap (heapUsed)   peak: ${m.peak} MB   avg: ${m.avg} MB   min: ${m.min} MB   (${m.samples} campioni)`);
  } else {
    console.log(`     🧠 Memoria: non disponibile — /metrics non raggiungibile`);
  }
  if (c.samples > 0) {
    console.log(`     ⚙️  CPU (user+sys)    peak: ${c.peak}%   avg: ${c.avg}%   min: ${c.min}%`);
  } else {
    console.log(`     ⚙️  CPU: non disponibile`);
  }
}

// ─── GESTIONE ERRORI GLOBALI ──────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('\n💥 CRASH NON CATTURATO (uncaughtException):');
  console.error('   Tipo:    ', err.constructor.name);
  console.error('   Messaggio:', err.message);
  console.error('   Stack:\n' + (err.stack || '(nessuno)'));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('\n💥 PROMISE RIFIUTATA (unhandledRejection):');
  console.error('   Motivo:', reason instanceof Error ? reason.stack : reason);
  process.exit(1);
});

// ─── ENDPOINTS ────────────────────────────────────────────────────────────────
const restService    = { REST:    'http://localhost:3001/' };
const graphqlService = { GraphQL: 'http://localhost:3002/' };
const grpcService    = { gRPC:    'grpc://localhost:3003'  };

// ─── OPZIONI ──────────────────────────────────────────────────────────────────
const baseOptions = {
  debug:       false,
  runMode:     'parallel',
  minSamples:  500,    // abbassato rispetto a 10000 per velocità — alza se vuoi più precisione
  maxTime:     10,
  delay:       0,
  stopOnError: false,
};

const optionsPar = {
  ...baseOptions,
  maxConcurrentRequests: 20,
};

// ─── PAYLOAD HELPER ───────────────────────────────────────────────────────────
// Genera una stringa di padding di lunghezza target (approssimata).
// targetBytes è la dimensione totale desiderata del payload JSON.
// baseBytes è la dimensione approssimativa dei campi fissi del body.
function pad(targetBytes, baseBytes) {
  const len = Math.max(0, targetBytes - baseBytes);
  return 'x'.repeat(len);
}

// Dimensioni target del payload in byte
const PAYLOAD = {
  small:  100,    //  ~100 B  — richiesta minima realistica
  medium: 1024,   //  ~1 KB   — uso comune
  large:  10240,  //  ~10 KB  — payload corposo
};

// ─── ROTTE REST ───────────────────────────────────────────────────────────────
// Campi fissi di POST /api/products: ~60 byte (name, price, stock, category)
const REST_BASE_BYTES = 60;

const restRoutes = {
  // [A] Health check
  'GET /health': {
    method: 'get', route: 'health', expectedStatusCode: 200
  },

  // [B] Lista prodotti
  'GET /api/products': {
    method: 'get', route: 'api/products', expectedStatusCode: 200
  },

  // [C] POST piccolo (~100 B)
  'POST /api/products [small ~100B]': {
    method: 'post', route: 'api/products',
    data: {
      name:        'Prodotto Bench',
      price:       49.99,
      stock:       10,
      category:    'bench',
      description: pad(PAYLOAD.small, REST_BASE_BYTES),
    },
    expectedStatusCode: 201,
  },

  // [D] POST medio (~1 KB)
  'POST /api/products [medium ~1KB]': {
    method: 'post', route: 'api/products',
    data: {
      name:        'Prodotto Bench',
      price:       49.99,
      stock:       10,
      category:    'bench',
      description: pad(PAYLOAD.medium, REST_BASE_BYTES),
    },
    expectedStatusCode: 201,
  },

  // [E] POST grande (~10 KB)
  'POST /api/products [large ~10KB]': {
    method: 'post', route: 'api/products',
    data: {
      name:        'Prodotto Bench',
      price:       49.99,
      stock:       10,
      category:    'bench',
      description: pad(PAYLOAD.large, REST_BASE_BYTES),
    },
    expectedStatusCode: 201,
  },
};

// ─── ROTTE GRAPHQL ────────────────────────────────────────────────────────────
// Campi fissi della mutation createProduct: ~80 byte (name, price, stock, category)
const GRAPHQL_BASE_BYTES = 80;

const graphqlRoutes = {
  // [A] Health check
  'GET /health': {
    method: 'get', route: 'health', expectedStatusCode: 200
  },

  // [B] Query lista prodotti
  'query products': {
    method:  'post',
    route:   'graphql',
    headers: { 'Content-Type': 'application/json' },
    data:    { query: '{ products { id name price stock category } }' },
    expectedStatusCode: 200,
  },

  // [C] Mutation piccola (~100 B)
  'createProduct [small ~100B]': {
    method:  'post',
    route:   'graphql',
    headers: { 'Content-Type': 'application/json' },
    data: {
      query: `mutation($desc: String) {
        createProduct(name: "Bench", price: 9.99, stock: 1, category: "bench", description: $desc) {
          success id receivedBytes descriptionLen
        }
      }`,
      variables: { desc: pad(PAYLOAD.small, GRAPHQL_BASE_BYTES) },
    },
    expectedStatusCode: 200,
  },

  // [D] Mutation media (~1 KB)
  'createProduct [medium ~1KB]': {
    method:  'post',
    route:   'graphql',
    headers: { 'Content-Type': 'application/json' },
    data: {
      query: `mutation($desc: String) {
        createProduct(name: "Bench", price: 9.99, stock: 1, category: "bench", description: $desc) {
          success id receivedBytes descriptionLen
        }
      }`,
      variables: { desc: pad(PAYLOAD.medium, GRAPHQL_BASE_BYTES) },
    },
    expectedStatusCode: 200,
  },

  // [E] Mutation grande (~10 KB)
  'createProduct [large ~10KB]': {
    method:  'post',
    route:   'graphql',
    headers: { 'Content-Type': 'application/json' },
    data: {
      query: `mutation($desc: String) {
        createProduct(name: "Bench", price: 9.99, stock: 1, category: "bench", description: $desc) {
          success id receivedBytes descriptionLen
        }
      }`,
      variables: { desc: pad(PAYLOAD.large, GRAPHQL_BASE_BYTES) },
    },
    expectedStatusCode: 200,
  },
};

// ─── ROTTE gRPC ───────────────────────────────────────────────────────────────
// Campi fissi di CreateProduct: ~50 byte (name, price, stock, category)
const GRPC_BASE_BYTES = 50;

const grpcRoutes = {
  // [A] Health check
  'HealthCheck': {
    protocol: 'grpc', method: 'HealthCheck', expectedStatusCode: 0
  },

  // [B] Lista prodotti
  'GetProducts': {
    protocol: 'grpc', method: 'GetProducts', data: {}, expectedStatusCode: 0
  },

  // [C] CreateProduct piccolo (~100 B)
  'CreateProduct [small ~100B]': {
    protocol: 'grpc',
    method:   'CreateProduct',
    data: {
      name:     'Prodotto Bench',
      price:    49.99,
      stock:    10,
      category: 'bench',
      notes:    pad(PAYLOAD.small, GRPC_BASE_BYTES),  // ← campo padding
    },
    expectedStatusCode: 0,
  },

  // [D] CreateProduct medio (~1 KB)
  'CreateProduct [medium ~1KB]': {
    protocol: 'grpc',
    method:   'CreateProduct',
    data: {
      name:     'Prodotto Bench',
      price:    49.99,
      stock:    10,
      category: 'bench',
      notes:    pad(PAYLOAD.medium, GRPC_BASE_BYTES),
    },
    expectedStatusCode: 0,
  },

  // [E] CreateProduct grande (~10 KB)
  'CreateProduct [large ~10KB]': {
    protocol: 'grpc',
    method:   'CreateProduct',
    data: {
      name:     'Prodotto Bench',
      price:    49.99,
      stock:    10,
      category: 'bench',
      notes:    pad(PAYLOAD.large, GRPC_BASE_BYTES),
    },
    expectedStatusCode: 0,
  },
};

// ─── UTILITY: MEDIANA ─────────────────────────────────────────────────────────
function median(samples) {
  if (!samples || samples.length === 0) return NaN;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ─── UTILITY: STAMPA RISULTATI SINGOLO SERVER ─────────────────────────────────
function printResults(title, results) {
  console.log('\n' + '═'.repeat(65));
  console.log(`  ${title}`);
  console.log('═'.repeat(65));

  if (!results || typeof results !== 'object') {
    console.log('  (nessun risultato)');
    return;
  }

  for (const [server, routes] of Object.entries(results)) {
    console.log(`\n  🖥  Server: ${server}`);
    for (const [route, result] of Object.entries(routes)) {
      const s       = result && result.stats;
      const hasData = s && s.sample && s.sample.length > 0;
      const errors  = result && result.errors && Object.keys(result.errors).length > 0
                      ? result.errors : null;

      if (hasData) {
        const med    = median(s.sample);
        const opsec  = isFinite(result.hz) ? result.hz.toFixed(2) : 'N/A';
        const meanMs = (s.mean   * 1000).toFixed(3);
        const medMs  = isFinite(med) ? (med * 1000).toFixed(3) : 'N/A';
        const p95Ms  = s.p95 !== undefined ? (s.p95 * 1000).toFixed(3) : 'N/A';
        const rme    = s.rme !== undefined ? s.rme.toFixed(2) + '%' : 'N/A';

        console.log(`     📍 ${route}`);
        console.log(`        mean:    ${meanMs} ms`);
        console.log(`        median:  ${medMs} ms`);
        console.log(`        p95:     ${p95Ms} ms`);
        console.log(`        ±rme:    ${rme}`);
        console.log(`        ops/sec: ${opsec}`);
        console.log(`        samples: ${s.sample.length}`);
        if (errors) console.log(`        ⚠ errori: ${JSON.stringify(errors)}`);
      } else if (errors) {
        console.log(`     ⚠  ${route}: ${JSON.stringify(errors)}`);
      } else {
        console.log(`     ❌ ${route}: nessun dato`);
      }
    }
  }
}

// ─── UTILITY: STAMPA CONFRONTO (compare) ─────────────────────────────────────
function printCompareResults(title, results) {
  console.log('\n' + '═'.repeat(65));
  console.log(`  ${title}`);
  console.log('═'.repeat(65));

  if (!results || typeof results !== 'object') {
    console.log('  (nessun risultato)');
    return;
  }

  // struttura compare: { routeName: { serverName: { hz, stats } } }
  for (const [route, servers] of Object.entries(results)) {
    console.log(`\n  📍 ${route}`);
    const rows = [];
    let bestHz = -Infinity, winner = null;

    for (const [server, result] of Object.entries(servers)) {
      if (result && result.stats && result.stats.sample && result.stats.sample.length > 0) {
        const hz    = isFinite(result.hz) ? result.hz : 0;
        const mean  = (result.stats.mean * 1000).toFixed(3);
        const med   = median(result.stats.sample);
        const medMs = isFinite(med) ? (med * 1000).toFixed(3) : 'N/A';
        const p95   = result.stats.p95 !== undefined
                      ? (result.stats.p95 * 1000).toFixed(3) + ' ms' : 'N/A';
        rows.push({ server, hz, mean, medMs, p95 });
        if (hz > bestHz) { bestHz = hz; winner = server; }
      }
    }

    rows.sort((a, b) => b.hz - a.hz);
    rows.forEach((r, i) => {
      const medal = ['🥇', '🥈', '🥉'][i] || '   ';
      const opsec = r.hz > 0 ? r.hz.toFixed(2) : 'N/A';
      console.log(
        `     ${medal} ${r.server.padEnd(12)}` +
        `  mean: ${r.mean} ms` +
        `  median: ${r.medMs} ms` +
        `  p95: ${r.p95}` +
        `  ops/sec: ${opsec}`
      );
    });

    if (winner) console.log(`     🏆 Vincitore: ${winner}`);
  }
}

// ─── WRAPPER PROMISE ──────────────────────────────────────────────────────────
function measure(services, routes, options) {
  return new Promise(resolve => {
    apiBenchmark.measure(services, routes, options, (err, results) => {
      if (err) console.error('  ⚠ Errore measure:', JSON.stringify(err));
      resolve(results);
    });
  });
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function runBenchmarks() {
  console.log('\n╔' + '═'.repeat(65) + '╗');
  console.log('║   API BENCHMARK — REST | GraphQL | gRPC                         ║');
  console.log('║   Latenza · Throughput · Memoria · CPU                          ║');
  console.log('║   POST payload variabile: small ~100B / medium ~1KB / large ~10KB ║');
  console.log('╚' + '═'.repeat(65) + '╝');
  console.log(`\n   REST :3001  |  GraphQL :3002  |  gRPC :3003 (metrics HTTP :3004)`);
  console.log(`   minSamples: ${baseOptions.minSamples} per rotta`);
  console.log(`   Campionamento risorse: ogni 250ms in parallelo al benchmark\n`);

  // ══════════════════════════════════════════════════════════════════
  // FASE 1 — BENCHMARK REST ISOLATO + CAMPIONAMENTO RISORSE
  // Il sampler gira in background mentre api-benchmark misura la latenza.
  // ══════════════════════════════════════════════════════════════════
  console.log('━'.repeat(65));
  console.log('  FASE 1/4 — REST isolato');
  console.log('━'.repeat(65));

  const restSampler = startSampling('REST', METRICS_URLS.REST);
  const restResults = await measure(restService, restRoutes, baseOptions);
  const restResources = await restSampler.stop();

  console.log(Object.entries(restResults)[0][1]);
  printResults('BENCHMARK REST — Latenza & Throughput', restResults);
  printResourceStats(restResources);

  // ══════════════════════════════════════════════════════════════════
  // FASE 2 — BENCHMARK GraphQL ISOLATO + CAMPIONAMENTO RISORSE
  // ══════════════════════════════════════════════════════════════════
  console.log('\n' + '━'.repeat(65));
  console.log('  FASE 2/4 — GraphQL isolato');
  console.log('━'.repeat(65));

  const graphqlSampler = startSampling('GraphQL', METRICS_URLS.GraphQL);
  const graphqlResults = await measure(graphqlService, graphqlRoutes, baseOptions);
  const graphqlResources = await graphqlSampler.stop();

  printResults('BENCHMARK GraphQL — Latenza & Throughput', graphqlResults);
  printResourceStats(graphqlResources);

  // ══════════════════════════════════════════════════════════════════
  // FASE 3 — BENCHMARK gRPC ISOLATO + CAMPIONAMENTO RISORSE
  // Il sampler legge /metrics dall'HTTP server sulla porta 3004.
  // ══════════════════════════════════════════════════════════════════
  console.log('\n' + '━'.repeat(65));
  console.log('  FASE 3/4 — gRPC isolato');
  console.log('━'.repeat(65));

  let grpcResults = null;
  const grpcSampler = startSampling('gRPC', METRICS_URLS.gRPC);

  await new Promise(resolve => {
    let done = false;
    const safeResolve = () => { if (!done) { done = true; resolve(); } };
    try {
      apiBenchmark.measure(grpcService, grpcRoutes, baseOptions, (err, results) => {
        if (err) console.error('  ⚠ Errore gRPC:', JSON.stringify(err, null, 2));
        grpcResults = results;
        safeResolve();
      });
    } catch (e) {
      console.error('  💥 Eccezione sincrona gRPC:', e.stack);
      safeResolve();
    }
  });

  const grpcResources = await grpcSampler.stop();

  printResults('BENCHMARK gRPC — Latenza & Throughput', grpcResults);
  printResourceStats(grpcResources);

  // ══════════════════════════════════════════════════════════════════
  // FASE 4 — CONFRONTO CROSS-PROTOCOLLO su POST + RISORSE AFFIANCATE
  // Ogni protocollo viene misurato separatamente (con il proprio sampler)
  // poi i risultati vengono assemblati per il confronto finale.
  // ══════════════════════════════════════════════════════════════════
  console.log('\n' + '━'.repeat(65));
  console.log('  FASE 4/4 — Confronto cross-protocollo');
  console.log('  REST (POST /api/products) vs GraphQL (mutation) vs gRPC (CreateProduct)');
  console.log('  Payload variabile: small / medium / large');
  console.log('━'.repeat(65));

  const restPostRoutes = {
    'POST small  (~100B)': restRoutes['POST /api/products [small ~100B]'],
    'POST medium (~1KB)':  restRoutes['POST /api/products [medium ~1KB]'],
    'POST large  (~10KB)': restRoutes['POST /api/products [large ~10KB]'],
  };
  const graphqlMutationRoutes = {
    'POST small  (~100B)': graphqlRoutes['createProduct [small ~100B]'],
    'POST medium (~1KB)':  graphqlRoutes['createProduct [medium ~1KB]'],
    'POST large  (~10KB)': graphqlRoutes['createProduct [large ~10KB]'],
  };
  const grpcCreateRoutes = {
    'POST small  (~100B)': grpcRoutes['CreateProduct [small ~100B]'],
    'POST medium (~1KB)':  grpcRoutes['CreateProduct [medium ~1KB]'],
    'POST large  (~10KB)': grpcRoutes['CreateProduct [large ~10KB]'],
  };

  // ── REST ──────────────────────────────────────────────────────────
  console.log('\n⏳ Misuro REST POST (con campionamento risorse)...');
  const restPostSampler = startSampling('REST', METRICS_URLS.REST);
  const rRest = await measure(restService, restPostRoutes, optionsPar);
  const restPostRes = await restPostSampler.stop();

  // ── GraphQL ───────────────────────────────────────────────────────
  console.log('⏳ Misuro GraphQL mutation (con campionamento risorse)...');
  const graphqlPostSampler = startSampling('GraphQL', METRICS_URLS.GraphQL);
  const rGraphQL = await measure(graphqlService, graphqlMutationRoutes, optionsPar);
  const graphqlPostRes = await graphqlPostSampler.stop();

  // ── gRPC ──────────────────────────────────────────────────────────
  console.log('⏳ Misuro gRPC CreateProduct (con campionamento risorse)...');
  let rGRPC = null;
  const grpcPostSampler = startSampling('gRPC', METRICS_URLS.gRPC);

  await new Promise(resolve => {
    let done = false;
    const safeResolve = () => { if (!done) { done = true; resolve(); } };
    try {
      apiBenchmark.measure(grpcService, grpcCreateRoutes, optionsPar, (err, results) => {
        if (err) console.error('  ⚠ Errore gRPC confronto:', JSON.stringify(err));
        rGRPC = results;
        safeResolve();
      });
    } catch (e) {
      console.error('  💥 Eccezione sincrona gRPC confronto:', e.stack);
      safeResolve();
    }
  });

  const grpcPostRes = await grpcPostSampler.stop();

  // ── Assembla confronto latenza ────────────────────────────────────
  const sizes     = ['POST small  (~100B)', 'POST medium (~1KB)', 'POST large  (~10KB)'];
  const crossProto = {};

  for (const size of sizes) {
    crossProto[size] = {};
    try {
      if (rRest   && rRest.REST      && rRest.REST[size])      crossProto[size].REST    = rRest.REST[size];
      if (rGraphQL && rGraphQL.GraphQL && rGraphQL.GraphQL[size]) crossProto[size].GraphQL = rGraphQL.GraphQL[size];
      if (rGRPC   && rGRPC.gRPC      && rGRPC.gRPC[size])      crossProto[size].gRPC    = rGRPC.gRPC[size];
    } catch (e) {
      console.error(`  ⚠ Assemblaggio confronto per "${size}":`, e.message);
    }
  }

  printCompareResults('CONFRONTO LATENZA — REST vs GraphQL vs gRPC (POST payload variabile)', crossProto);

  // ── Confronto risorse affiancato ──────────────────────────────────
  console.log('\n' + '═'.repeat(65));
  console.log('  CONFRONTO RISORSE — REST vs GraphQL vs gRPC (durante POST)');
  console.log('═'.repeat(65));
  console.log('\n  Server         Heap peak    Heap avg    CPU peak    CPU avg');
  console.log('  ' + '─'.repeat(62));

  for (const res of [restPostRes, graphqlPostRes, grpcPostRes]) {
    const m = res.memory;
    const c = res.cpu;
    const heapPeak = m.samples > 0 ? `${m.peak} MB` : 'N/A';
    const heapAvg  = m.samples > 0 ? `${m.avg} MB`  : 'N/A';
    const cpuPeak  = c.samples > 0 ? `${c.peak}%`   : 'N/A';
    const cpuAvg   = c.samples > 0 ? `${c.avg}%`    : 'N/A';
    console.log(
      `  ${res.label.padEnd(14)} ${heapPeak.padEnd(12)} ${heapAvg.padEnd(11)} ${cpuPeak.padEnd(11)} ${cpuAvg}`
    );
  }

  // Vincitore per ogni categoria risorse
  const byHeap = [restPostRes, graphqlPostRes, grpcPostRes]
    .filter(r => r.memory.samples > 0)
    .sort((a, b) => a.memory.peak - b.memory.peak);
  const byCpu = [restPostRes, graphqlPostRes, grpcPostRes]
    .filter(r => r.cpu.samples > 0)
    .sort((a, b) => a.cpu.avg - b.cpu.avg);

  if (byHeap.length > 0) console.log(`\n  🧠 Heap più basso:  ${byHeap[0].label} (peak ${byHeap[0].memory.peak} MB)`);
  if (byCpu.length  > 0) console.log(`  ⚙️  CPU più bassa:   ${byCpu[0].label}  (avg  ${byCpu[0].cpu.avg}%)`);

  // ── HTML Report ───────────────────────────────────────────────────
  console.log('\n⏳ Generazione HTML report...');

  const reportData = {};
  for (const size of sizes) {
    if (crossProto[size] && Object.keys(crossProto[size]).length > 0)
      reportData[size] = crossProto[size];
  }

  if (Object.keys(reportData).length === 0) {
    console.error('  ⚠ Nessun dato disponibile per il report HTML.');
  } else {
    await new Promise(resolve => {
      apiBenchmark.getHtml(reportData, (htmlErr, html) => {
        if (htmlErr) { console.error('  ⚠ getHtml:', htmlErr); resolve(); return; }
        const outPath = path.join(__dirname, 'report.html');
        fs.writeFileSync(outPath, html);
        console.log(`\n✅ HTML Report (latenza) salvato in: ${outPath}`);
        resolve();
      });
    });
  }

  // ── Riepilogo finale ──────────────────────────────────────────────
  console.log('\n' + '╔' + '═'.repeat(65) + '╗');
  console.log('║   ✅  Benchmark completato!                                    ║');
  console.log('╚' + '═'.repeat(65) + '╝');
  console.log('\n  Legenda payload:');
  console.log(`    small  = ~${PAYLOAD.small}  B  (campo 'description' / 'notes' minimo)`);
  console.log(`    medium = ~${PAYLOAD.medium} B  (≈ 1 KB)`);
  console.log(`    large  = ~${PAYLOAD.large} B (≈ 10 KB)`);
  console.log('\n  Tuning:');
  console.log('    PAYLOAD.large    → cambia dimensione payload massima');
  console.log('    baseOptions.minSamples → alza per più precisione statistica');
  console.log('    startSampling intervalMs (250) → abbassa per più campioni CPU/mem\n');
}

runBenchmarks().catch(console.error);
