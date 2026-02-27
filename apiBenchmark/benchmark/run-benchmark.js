/**
 * run-benchmark.js
 * Benchmark completo di tutti e 6 i server usando la libreria api-benchmark
 *
 * Esegui DOPO aver avviato tutti i server con: node servers/start-all.js
 */
const apiBenchmark = require('api-benchmark');
const fs = require('fs');
const path = require('path');

// ─── CONFIGURAZIONE SERVERS ───────────────────────────────────────────────────
const services = {
  REST:      'http://localhost:3001/',
  MQTT:      'http://localhost:3002/',
  SOAP:      'http://localhost:3003/',
  GraphQL:   'http://localhost:3004/',
  Webhooks:  'http://localhost:3005/',
  gRPC:      'http://localhost:3006/',
};

// ─── ROUTE COMUNI ─────────────────────────────────────────────────────────────
// api-benchmark confronta le stesse route su tutti i server.
// Ogni server ha un endpoint /health standard.
const commonRoutes = {
  health: {
    method: 'get',
    route: 'health',
    expectedStatusCode: 200,
    maxMean: 0.5,         // errore se mean > 500ms
    maxSingleMean: 2.0    // errore se singola request > 2s
  }
};

// ─── ROUTE SPECIFICHE PER SERVER ──────────────────────────────────────────────

// REST - benchmark su più endpoint
const restService = { REST: 'http://localhost:3001/' };
const restRoutes = {
  'GET /api/users': {
    method: 'get',
    route: 'api/users',
    expectedStatusCode: 200
  },
  'GET /api/products': {
    method: 'get',
    route: 'api/products',
    expectedStatusCode: 200
  },
  'POST /api/users': {
    method: 'post',
    route: 'api/users',
    data: { name: 'Test User', email: 'test@test.com', age: 30 },
    expectedStatusCode: 201
  }
};

// GraphQL - benchmark query diverse
const graphqlService = { GraphQL: 'http://localhost:3004/' };
const graphqlRoutes = {
  'query users': {
    method: 'post',
    route: 'graphql',
    headers: { 'Content-Type': 'application/json' },
    data: { query: '{ users { id name email } }' },
    expectedStatusCode: 200
  },
  'query products': {
    method: 'post',
    route: 'graphql',
    headers: { 'Content-Type': 'application/json' },
    data: { query: '{ products { id name price } }' },
    expectedStatusCode: 200
  },
  'query stats': {
    method: 'post',
    route: 'graphql',
    headers: { 'Content-Type': 'application/json' },
    data: { query: '{ stats { totalUsers totalProducts timestamp } }' },
    expectedStatusCode: 200
  }
};

// MQTT Bridge
const mqttService = { MQTT: 'http://localhost:3002/' };
const mqttRoutes = {
  'mqtt/ping': {
    method: 'get',
    route: 'mqtt/ping',
    expectedStatusCode: 200
  },
  'mqtt/users': {
    method: 'get',
    route: 'mqtt/users',
    expectedStatusCode: 200
  }
};

// Webhooks
const webhookService = { Webhooks: 'http://localhost:3005/' };
const webhookRoutes = {
  'subscriptions list': {
    method: 'get',
    route: 'webhooks/subscriptions',
    expectedStatusCode: 200
  },
  'logs': {
    method: 'get',
    route: 'webhooks/logs',
    expectedStatusCode: 200
  }
};

// gRPC Bridge
const grpcService = { gRPC: 'http://localhost:3006/' };
const grpcRoutes = {
  'grpc/users': {
    method: 'get',
    route: 'grpc/users',
    expectedStatusCode: 200
  },
  'grpc/products': {
    method: 'get',
    route: 'grpc/products',
    expectedStatusCode: 200
  }
};

// ─── OPZIONI BENCHMARK ────────────────────────────────────────────────────────
const options = {
  debug: false,
  runMode: 'sequence',   // 'sequence' | 'parallel'
  minSamples: 20,
  maxTime: 10,
  delay: 0,
  stopOnError: false     // continua anche in caso di errore
};

const optionsParallel = {
  ...options,
  runMode: 'parallel',
  maxConcurrentRequests: 10
};

// ─── UTILITY: STAMPA RISULTATI ────────────────────────────────────────────────
function printResults(title, results) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));

  if (!results || typeof results !== 'object') {
    console.log('  (nessun risultato)');
    return;
  }

  // results è strutturato come { serverName: { routeName: benchmarkResult } }
  for (const [server, routes] of Object.entries(results)) {
    console.log(`\n  🖥  Server: ${server}`);
    for (const [route, stats] of Object.entries(routes)) {
      if (stats && stats.stats) {
        const s = stats.stats;
        console.log(`     📍 ${route}`);
        console.log(`        mean:    ${(s.mean * 1000).toFixed(2)} ms`);
        console.log(`        median:  ${(s.median * 1000).toFixed(2)} ms`);
        console.log(`        ops/sec: ${s.hz ? s.hz.toFixed(2) : 'N/A'}`);
        console.log(`        samples: ${s.sample ? s.sample.length : 'N/A'}`);
      } else if (stats && stats.error) {
        console.log(`     ❌ ${route}: ${stats.error}`);
      } else {
        console.log(`     ⚠  ${route}: ${JSON.stringify(stats)}`);
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

  // Confronto: mostra il vincitore per ogni route
  for (const [route, servers] of Object.entries(results)) {
    console.log(`\n  📍 Route: ${route}`);
    let winner = null;
    let bestHz = 0;

    const serverStats = [];
    for (const [server, stats] of Object.entries(servers)) {
      if (stats && stats.stats) {
        const hz = stats.stats.hz || 0;
        const mean = (stats.stats.mean * 1000).toFixed(2);
        serverStats.push({ server, hz, mean });
        if (hz > bestHz) {
          bestHz = hz;
          winner = server;
        }
      }
    }

    serverStats.sort((a, b) => b.hz - a.hz);
    serverStats.forEach((s, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
      console.log(`     ${medal} ${s.server.padEnd(12)} mean: ${s.mean}ms  ops/sec: ${s.hz.toFixed(2)}`);
    });

    if (winner) console.log(`     🏆 Vincitore: ${winner}`);
  }
}

// ─── ESEGUI BENCHMARK ─────────────────────────────────────────────────────────
async function runBenchmarks() {
  console.log('\n🔧 api-benchmark - Confronto 6 protocolli API');
  console.log('   REST | MQTT | SOAP | GraphQL | Webhooks | gRPC\n');

  // 1. Confronto HEALTH CHECK su tutti i server
  console.log('⏳ [1/5] Confronto /health su tutti i server...');
  await new Promise((resolve) => {
    apiBenchmark.compare(services, commonRoutes, options, (err, results) => {
      if (err) console.error('Errore:', err);
      printCompareResults('CONFRONTO /health - Tutti i Server', results);
      resolve();
    });
  });

  // 2. Benchmark REST (sequenziale e parallelo)
  console.log('\n⏳ [2/5] Benchmark endpoint REST...');
  await new Promise((resolve) => {
    apiBenchmark.measure(restService, restRoutes, options, (err, results) => {
      if (err) console.error('Errore REST:', err);
      printResults('BENCHMARK REST - Tutti gli endpoint', results);
      resolve();
    });
  });

  // 3. Benchmark GraphQL
  console.log('\n⏳ [3/5] Benchmark endpoint GraphQL...');
  await new Promise((resolve) => {
    apiBenchmark.measure(graphqlService, graphqlRoutes, options, (err, results) => {
      if (err) console.error('Errore GraphQL:', err);
      printResults('BENCHMARK GraphQL - Query diverse', results);
      resolve();
    });
  });

  // 4. Benchmark gRPC Bridge
  console.log('\n⏳ [4/5] Benchmark gRPC (via HTTP Bridge)...');
  await new Promise((resolve) => {
    apiBenchmark.measure(grpcService, grpcRoutes, options, (err, results) => {
      if (err) console.error('Errore gRPC:', err);
      printResults('BENCHMARK gRPC - Via HTTP Bridge', results);
      resolve();
    });
  });

  // 5. Confronto REST vs GraphQL vs gRPC (tutti espongono /health)
  console.log('\n⏳ [5/5] Confronto parallelo REST vs GraphQL vs gRPC...');
  const modernServices = {
    REST:    'http://localhost:3001/',
    GraphQL: 'http://localhost:3004/',
    gRPC:    'http://localhost:3006/',
  };
  await new Promise((resolve) => {
    apiBenchmark.compare(modernServices, commonRoutes, optionsParallel, (err, results) => {
      if (err) console.error('Errore compare:', err);
      printCompareResults('CONFRONTO PARALLELO: REST vs GraphQL vs gRPC', results);
      resolve();
    });
  });

  // ─── GENERA HTML REPORT ───────────────────────────────────────────────────
  console.log('\n⏳ Generazione HTML report...');
  await new Promise((resolve) => {
    apiBenchmark.compare(services, commonRoutes, options, (err, results) => {
      if (err) { console.error(err); resolve(); return; }
      apiBenchmark.getHtml(results, (htmlErr, html) => {
        if (htmlErr) { console.error(htmlErr); resolve(); return; }
        const outPath = path.join(__dirname, 'report.html');
        fs.writeFileSync(outPath, html);
        console.log(`\n✅ HTML Report salvato in: ${outPath}`);
        resolve();
      });
    });
  });

  console.log('\n' + '═'.repeat(60));
  console.log('  ✅ Benchmark completato!');
  console.log('═'.repeat(60) + '\n');
}

runBenchmarks().catch(console.error);
