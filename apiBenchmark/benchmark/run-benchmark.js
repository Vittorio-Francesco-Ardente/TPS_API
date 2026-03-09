/**
 * run-benchmark.js
 * Benchmark completo — REST | GraphQL | gRPC
 *
 * Esegui DOPO aver avviato tutti i server:  node servers/start-all.js
 */

const apiBenchmark = require('api-benchmark');
const fs   = require('fs');
const path = require('path');

// ─── GESTIONE ERRORI GLOBALI ──────────────────────────────────────────────────
// Cattura qualsiasi crash silenzioso e stampa l'errore completo prima di uscire.
// Rimuovi questi handler una volta risolti i problemi.

process.on('uncaughtException', (err) => {
  console.error('\n💥 CRASH NON CATTURATO (uncaughtException):');
  console.error('   Tipo:    ', err.constructor.name);
  console.error('   Messaggio:', err.message);
  console.error('   Stack:\n' + (err.stack || '(nessuno)'));
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n💥 PROMISE RIFIUTATA (unhandledRejection):');
  console.error('   Motivo:', reason instanceof Error ? reason.stack : reason);
  process.exit(1);
});

// ─── CONFIGURAZIONE SERVERS ───────────────────────────────────────────────────

const restService    = { REST:    'http://localhost:3001/' };
const graphqlService = { GraphQL: 'http://localhost:3002/' };
const grpcService    = { gRPC:    'grpc://localhost:3003'  };  // NO slash finale per gRPC

const httpServices = {
  REST:    'http://localhost:3001/',
  GraphQL: 'http://localhost:3002/',
};

// ─── OPZIONI ──────────────────────────────────────────────────────────────────

const optionsSeq = {
  debug:       true,
  runMode:     'parallel',
  minSamples:  10000,
  maxTime:     10,
  delay:       0,
  stopOnError: false
};

const optionsPar = {
  ...optionsSeq,
  runMode:               'parallel',
  maxConcurrentRequests: 20
};

// ─── ROUTE REST ───────────────────────────────────────────────────────────────

const restRoutes = {
  'health': {
    method: 'get', route: 'health',
    expectedStatusCode: 200,
    
  },
  'GET /api/users': {
    method: 'get', route: 'api/users', expectedStatusCode: 200
  },
  'GET /api/products': {
    method: 'get', route: 'api/products', expectedStatusCode: 200
  },
  'POST /api/users': {
    method: 'post', route: 'api/users',
    data: { name: 'Test User', email: 'test@test.com', age: 30 },
    expectedStatusCode: 201
  }
};

// ─── ROUTE GRAPHQL ────────────────────────────────────────────────────────────

const graphqlRoutes = {
  'health': {
    method: 'get', route: 'health', expectedStatusCode: 200
  },
  'query users': {
    method: 'post', route: 'graphql',
    headers: { 'Content-Type': 'application/json' },
    data:    { query: '{ users { id name email } }' },
    expectedStatusCode: 200
  },
  'query products': {
    method: 'post', route: 'graphql',
    headers: { 'Content-Type': 'application/json' },
    data:    { query: '{ products { id name price } }' },
    expectedStatusCode: 200
  },
  'query stats': {
    method: 'post', route: 'graphql',
    headers: { 'Content-Type': 'application/json' },
    data:    { query: '{ stats { totalUsers totalProducts timestamp } }' },
    expectedStatusCode: 200
  }
};

// ─── ROUTE gRPC ───────────────────────────────────────────────────────────────
// protocol: 'grpc'       → la libreria usa BenchmarkService.Call internamente
// method:                → nome logico in BenchmarkRequest.method
// expectedStatusCode: 0  → gRPC status OK (NON 200)
//
// REQUISITO: il server gRPC deve esporre BenchmarkService (grpc-benchmark.proto).
// Usa il file grpc-server.js aggiornato che aggiunge il BenchmarkService adapter.

const grpcRoutes = {
  'HealthCheck': {
    protocol: 'grpc', method: 'HealthCheck', expectedStatusCode: 0
  },
  'GetUsers': {
    protocol: 'grpc', method: 'GetUsers', data: {}, expectedStatusCode: 0
  },
  'GetProducts': {
    protocol: 'grpc', method: 'GetProducts', data: {}, expectedStatusCode: 0
  },
  'GetUserById': {
    protocol: 'grpc', method: 'GetUserById', data: { id: 1 }, expectedStatusCode: 0
  },
  'GetProductById': {
    protocol: 'grpc', method: 'GetProductById', data: { id: 1 }, expectedStatusCode: 0
  },
  'CreateUser': {
    protocol: 'grpc', method: 'CreateUser',
    data: { name: 'Benchmark User', email: 'bench@test.com', age: 25 },
    expectedStatusCode: 0
  }
};

const commonHttpRoutes = {
  health: {
    method: 'get', route: 'health',
    expectedStatusCode: 200, maxMean: 0.5, maxSingleMean: 2.0
  }
};

// ─── UTILITY: CALCOLO MEDIANA ─────────────────────────────────────────────────
// La libreria calcola mean, p75, p95, p99 ma NON median — la calcoliamo dai sample.

function median(samples) {
  if (!samples || samples.length === 0) return NaN;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ─── UTILITY: STAMPA RISULTATI ────────────────────────────────────────────────
// Struttura risultato dalla libreria:
//   { serverName: { routeName: { hz, stats: { mean, sample, moe, rme, p95, … }, errors } } }
// NOTA: hz è a livello root, NON dentro stats. median va calcolata dai sample.

function printResults(title, results) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));

  if (!results || typeof results !== 'object') {
    console.log('  (nessun risultato)');
    return;
  }

  for (const [server, routes] of Object.entries(results)) {
    console.log(`\n  🖥  Server: ${server}`);
    for (const [route, result] of Object.entries(routes)) {
      const s      = result && result.stats;
      const hasData = s && s.sample && s.sample.length > 0;
      const errors  = result && result.errors && Object.keys(result.errors).length > 0
                      ? result.errors : null;

      if (hasData) {
        const med    = median(s.sample);
        const opsec  = isFinite(result.hz) ? result.hz.toFixed(2) : 'N/A';
        const meanMs = (s.mean * 1000).toFixed(3);
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

function printCompareResults(title, results) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));

  if (!results || typeof results !== 'object') {
    console.log('  (nessun risultato)');
    return;
  }

  // compare: { routeName: { serverName: { hz, stats } } }
  for (const [route, servers] of Object.entries(results)) {
    console.log(`\n  📍 Route: ${route}`);
    const rows = [];
    let bestHz = -Infinity, winner = null;

    for (const [server, result] of Object.entries(servers)) {
      if (result && result.stats && result.stats.sample && result.stats.sample.length > 0) {
        const hz    = isFinite(result.hz) ? result.hz : 0;
        const mean  = (result.stats.mean * 1000).toFixed(3);
        const med   = median(result.stats.sample);
        const medMs = isFinite(med) ? (med * 1000).toFixed(3) : 'N/A';
        rows.push({ server, hz, mean, medMs });
        if (hz > bestHz) { bestHz = hz; winner = server; }
      }
    }

    rows.sort((a, b) => b.hz - a.hz);
    rows.forEach((r, i) => {
      const medal = ['🥇', '🥈', '🥉'][i] || '  ';
      const opsec = r.hz > 0 ? r.hz.toFixed(2) : 'N/A';
      console.log(`     ${medal} ${r.server.padEnd(12)}  mean: ${r.mean}ms  median: ${r.medMs}ms  ops/sec: ${opsec}`);
    });

    if (winner) console.log(`     🏆 Vincitore: ${winner}`);
  }
}

// ─── ESEGUI BENCHMARK ─────────────────────────────────────────────────────────

async function runBenchmarks() {
  console.log('\n🔧 api-benchmark — REST | GraphQL | gRPC');
  console.log('   Porta 3001 (REST) | 3002 (GraphQL) | 3003 (gRPC)\n');

  // 1. Benchmark REST
  console.log('⏳ [1/6] Benchmark endpoint REST...');
  await new Promise(resolve => {
    apiBenchmark.measure(restService, restRoutes, optionsSeq, (err, results) => {
      if (err) console.error('   ⚠ Errore REST:', err);
      printResults('BENCHMARK REST', results);
      resolve();
    });
  });

  // 2. Benchmark GraphQL
  console.log('\n⏳ [2/6] Benchmark endpoint GraphQL...');
  await new Promise(resolve => {
    apiBenchmark.measure(graphqlService, graphqlRoutes, optionsSeq, (err, results) => {
      if (err) console.error('   ⚠ Errore GraphQL:', err);
      printResults('BENCHMARK GraphQL', results);
      resolve();
    });
  });

  // 3. Benchmark gRPC nativo
  console.log('\n⏳ [3/6] Benchmark gRPC (RPC native)...');
  console.log('   [DEBUG] se il processo si chiude qui senza messaggi,');
  console.log('   [DEBUG] significa che grpc-server.js NON ha BenchmarkService.');
  await new Promise(resolve => {
    let done = false;
    const safeResolve = (label) => {
      if (!done) { done = true; console.log('   [DEBUG] callback ricevuta: ' + label); resolve(); }
    };
    try {
      apiBenchmark.measure(grpcService, grpcRoutes, optionsSeq, (err, results) => {
        if (err) console.error('   ⚠ Errore gRPC:', JSON.stringify(err, null, 2));
        printResults('BENCHMARK gRPC — RPC native', results);
        safeResolve('ok');
      });
    } catch(e) {
      console.error('   💥 Eccezione sincrona:', e.stack);
      safeResolve('catch-sync');
    }
  });

  // 4. Confronto REST vs GraphQL (HTTP puro, parallelo)
  console.log('\n⏳ [4/6] Confronto REST vs GraphQL su /health...');
  await new Promise(resolve => {
    apiBenchmark.compare(httpServices, commonHttpRoutes, optionsPar, (err, results) => {
      if (err) console.error('   ⚠ Errore compare HTTP:', err);
      printCompareResults('CONFRONTO REST vs GraphQL — /health', results);
      resolve();
    });
  });

  // 5. Confronto latenza tra RPC gRPC diverse
  console.log('\n⏳ [5/6] Confronto latenza tra RPC gRPC...');
  const grpcLatencyRoutes = {
    'HealthCheck': { protocol: 'grpc', method: 'HealthCheck', expectedStatusCode: 0 },
    'GetUsers':    { protocol: 'grpc', method: 'GetUsers',    expectedStatusCode: 0 },
    'GetProducts': { protocol: 'grpc', method: 'GetProducts', expectedStatusCode: 0 }
  };
  await new Promise(resolve => {
    apiBenchmark.measure(grpcService, grpcLatencyRoutes, optionsPar, (err, results) => {
      if (err) console.error('   ⚠ Errore gRPC latency:', err);
      printResults('CONFRONTO latenza RPC gRPC', results);
      resolve();
    });
  });
  // 6. Confronto diretto REST vs GraphQL vs gRPC su health
  console.log('\n⏳ [6/6] Confronto REST vs GraphQL vs gRPC su health...');
  let restHealthResults, graphqlHealthResults, grpcHealthResults;

  // REST /health
  await new Promise(resolve => {
    apiBenchmark.measure(restService, { health: restRoutes.health }, optionsPar, (err, results) => {
      if (err) console.error('   ⚠ Errore REST health:', err);
      restHealthResults = results;
      resolve();
    });
  });

  // GraphQL /health
  await new Promise(resolve => {
    apiBenchmark.measure(graphqlService, { health: graphqlRoutes.health }, optionsPar, (err, results) => {
      if (err) console.error('   ⚠ Errore GraphQL health:', err);
      graphqlHealthResults = results;
      resolve();
    });
  });

  // gRPC HealthCheck (status 0)
  await new Promise(resolve => {
    apiBenchmark.measure(grpcService, { HealthCheck: grpcRoutes.HealthCheck }, optionsPar, (err, results) => {
      if (err) console.error('   ⚠ Errore gRPC HealthCheck:', err);
      grpcHealthResults = results;
      resolve();
    });
  });

  const crossProtoCompare = {
    health: {}
  };

  try {
    if (restHealthResults && restHealthResults.REST && restHealthResults.REST.health) {
      crossProtoCompare.health.REST = restHealthResults.REST.health;
    }
    if (graphqlHealthResults && graphqlHealthResults.GraphQL && graphqlHealthResults.GraphQL.health) {
      crossProtoCompare.health.GraphQL = graphqlHealthResults.GraphQL.health;
    }
    if (grpcHealthResults && grpcHealthResults.gRPC && grpcHealthResults.gRPC.HealthCheck) {
      crossProtoCompare.health.gRPC = grpcHealthResults.gRPC.HealthCheck;
    }

    printCompareResults('CONFRONTO REST vs GraphQL vs gRPC — health', crossProtoCompare);
  } catch (e) {
    console.error('   ⚠ Errore durante la costruzione del confronto cross-protocollo:', e);
  }
  // ─── HTML REPORT ──────────────────────────────────────────────────────────
  console.log('\n⏳ Generazione HTML report (REST vs GraphQL vs gRPC - health)...');
  await new Promise(resolve => {
    const results = crossProtoCompare;

    if (!results || !results.health || Object.keys(results.health).length === 0) {
      console.error('   ⚠ Nessun dato disponibile per generare il report HTML.');
      resolve();
      return;
    }

    apiBenchmark.getHtml(results, (htmlErr, html) => {
      if (htmlErr) { console.error('   ⚠ getHtml:', htmlErr); resolve(); return; }
      const outPath = path.join(__dirname, 'report.html');
      fs.writeFileSync(outPath, html);
      console.log(`\n✅ HTML Report (REST vs GraphQL vs gRPC) salvato in: ${outPath}`);
      resolve();
    });
  });

  console.log('\n' + '═'.repeat(60));
  console.log('  ✅ Benchmark completato!');
  console.log('═'.repeat(60) + '\n');
}

runBenchmarks().catch(console.error);
