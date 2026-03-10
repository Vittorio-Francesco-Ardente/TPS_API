/**
 * benchmark-server.js — Port 3005
 */

const express      = require('express');
const cors         = require('cors');
const fs           = require('fs');
const path         = require('path');
const apiBenchmark = require('api-benchmark');

const app  = express();
const PORT = 3005;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

let runStatus = 'idle';

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad(targetBytes, baseBytes) {
  return 'x'.repeat(Math.max(0, targetBytes - baseBytes));
}

const SIZES = { tiny: 16, small: 64, medium: 1024, large: 8192, huge: 65536 };

function median(samples) {
  if (!samples || samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function measure(services, routes, options) {
  return new Promise(resolve => {
    console.log(`  → measure() chiamato con services:`, JSON.stringify(services));
    apiBenchmark.measure(services, routes, options, (err, results) => {
      if (err) {
        console.error('  ⚠ measure error:', JSON.stringify(err));
        resolve({});
        return;
      }
      console.log('  ✅ measure() completato');
      resolve(results);
    });
  });
}

// ── Resource sampler ──────────────────────────────────────────────────────────

const METRICS_URLS = {
  REST:    'http://localhost:3001/metrics',
  GraphQL: 'http://localhost:3002/metrics',
  gRPC:    'http://localhost:3004/metrics',
};

function startSampling(label, metricsUrl, intervalMs = 250) {
  const mem = [];
  const cpu = [];
  let stopped = false;
  let errors  = 0;

  const loop = (async () => {
    while (!stopped) {
      try {
        const res  = await fetch(metricsUrl, { signal: AbortSignal.timeout(500) });
        const data = await res.json();
        if (typeof data?.memory?.heapUsed === 'number') mem.push(data.memory.heapUsed);
        if (typeof data?.cpu?.totalPct    === 'number') cpu.push(data.cpu.totalPct);
      } catch { errors++; }
      await new Promise(r => setTimeout(r, intervalMs));
    }
  })();

  const summarize = (arr, unit) => {
    if (arr.length === 0) return { peak: 0, avg: 0, min: 0, samples: 0, unit };
    const peak = Math.max(...arr);
    const min  = Math.min(...arr);
    const avg  = arr.reduce((a, b) => a + b, 0) / arr.length;
    return { peak: +peak.toFixed(2), avg: +avg.toFixed(2), min: +min.toFixed(2), samples: arr.length, unit };
  };

  return {
    stop: async () => {
      stopped = true;
      await loop;
      return {
        label,
        memory: summarize(mem, 'MB'),
        cpu:    summarize(cpu, '%'),
        samplingErrors: errors,
      };
    },
  };
}

// ── Converti risultato → ProtocolMetrics ──────────────────────────────────────

function toProtocolMetrics(protocol, routeKey, results, totalDurationMs, resources) {
  const serviceResult = Object.values(results)[0];
  if (!serviceResult) {
    console.warn(`  ⚠ nessun serviceResult per ${protocol}`);
    return fallbackMetrics(protocol, totalDurationMs, resources);
  }

  const route = serviceResult[routeKey];
  if (!route) {
    console.warn(`  ⚠ routeKey "${routeKey}" non trovato in`, Object.keys(serviceResult));
    return fallbackMetrics(protocol, totalDurationMs, resources);
  }

  const s = route.stats ?? {};
  return {
    protocol,
    latencySamples:      s.sample        ?? [],
    meanLatencyMs:       +(s.mean        ?? 0).toFixed(3),
    singleMeanLatencyMs: +(s.singleMean  ?? 0).toFixed(3),
    medianLatencyMs:     +median(s.sample ?? []).toFixed(3),
    varianceLatencyMs:   +(s.variance    ?? 0).toFixed(3),
    deviationLatencyMs:  +(s.deviation   ?? 0).toFixed(3),
    semLatencyMs:        +(s.sem         ?? 0).toFixed(3),
    moeLatencyMs:        +(s.moe         ?? 0).toFixed(3),
    rmeLatencyPercent:   +(s.rme         ?? 0).toFixed(3),
    p75LatencyMs:        +(s.p75         ?? 0).toFixed(3),
    p95LatencyMs:        +(s.p95         ?? 0).toFixed(3),
    p99LatencyMs:        +(s.p99         ?? 0).toFixed(3),
    p999LatencyMs:       +(s.p999        ?? 0).toFixed(3),
    throughput:          +(route.hz       ?? 0).toFixed(1),
    errorCount:          s.sample?.length > 0
      ? +((Object.keys(route.errors ?? {}).length / s.sample.length) * 100).toFixed(1)
      : 0,
    totaldurationMs:     +totalDurationMs.toFixed(1),
    metrics:             resources,
  };
}

function fallbackMetrics(protocol, totalDurationMs, resources) {
  const empty = { peak: 0, avg: 0, min: 0, samples: 0, unit: '' };
  return {
    protocol,
    latencySamples: [], meanLatencyMs: 0, singleMeanLatencyMs: 0,
    medianLatencyMs: 0, varianceLatencyMs: 0, deviationLatencyMs: 0,
    semLatencyMs: 0, moeLatencyMs: 0, rmeLatencyPercent: 0,
    p75LatencyMs: 0, p95LatencyMs: 0, p99LatencyMs: 0, p999LatencyMs: 0,
    throughput: 0, errorCount: 0, totaldurationMs: totalDurationMs,
    metrics: resources ?? { label: protocol, memory: empty, cpu: empty, samplingErrors: 0 },
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  console.log('  GET /health');
  res.json({ ok: true, port: PORT });
});

app.get('/status', (_req, res) => res.json({ status: runStatus }));

app.post('/run', async (req, res) => {
  console.log('\n📥 POST /run ricevuto', JSON.stringify(req.body));

  if (runStatus === 'running') {
    console.log('  ⚠ già in corso, rifiuto');
    return res.status(409).json({ error: 'Benchmark già in corso' });
  }

  const {
    protocols   = ['REST', 'GraphQL', 'gRPC'],
    iterations  = 50,
    payloadSize = 'medium',
    concurrency = 1,
  } = req.body ?? {};

  const payloadBytes = SIZES[payloadSize] ?? 1024;
  console.log(`  protocols: ${protocols}, iterations: ${iterations}, payload: ${payloadSize} (${payloadBytes}B)`);

  const baseOptions = {
    debug: true,
    runMode: 'sequence',
    minSamples: iterations,
    maxTime: 15,
    delay: 0,
    stopOnError: false,
    maxConcurrentRequests: Math.max(1, concurrency),
  };

  const routesByProtocol = {
    REST: {
      service: { REST: 'http://localhost:3001/' },
      routes: {
        'POST /api/products': {
          method: 'post',
          route: 'api/products',
          data: {
            name: 'Prodotto Bench', price: 49.99, stock: 10, category: 'bench',
            description: pad(payloadBytes, 60),
          },
          expectedStatusCode: 201,
        },
      },
      routeKey: 'POST /api/products',
    },
    GraphQL: {
      service: { GraphQL: 'http://localhost:3002/' },
      routes: {
        'createProduct': {
          method: 'post',
          route: 'graphql',
          headers: { 'Content-Type': 'application/json' },
          data: {
            query: `mutation($desc: String) {
              createProduct(name: "Bench", price: 9.99, stock: 1, category: "bench", description: $desc) {
                success id
              }
            }`,
            variables: { desc: pad(payloadBytes, 80) },
          },
          expectedStatusCode: 200,
        },
      },
      routeKey: 'createProduct',
    },
    gRPC: {
      service: { gRPC: 'grpc://localhost:3003' },
      routes: {
        'CreateProduct': {
          protocol: 'grpc',
          method: 'CreateProduct',
          data: {
            name: 'Prodotto Bench', price: 49.99, stock: 10, category: 'bench',
            notes: pad(payloadBytes, 50),
          },
          expectedStatusCode: 0,
        },
      },
      routeKey: 'CreateProduct',
    },
  };

  runStatus = 'running';
  const output = [];
  let crossProto = {};

  try {
    for (const protocol of protocols) {
      console.log(`\n▶ Avvio benchmark ${protocol}...`);
      const def = routesByProtocol[protocol];
      if (!def) { console.warn(`  ⚠ protocollo sconosciuto: ${protocol}`); continue; }

      const sampler = startSampling(protocol, METRICS_URLS[protocol]);
      const tStart  = Date.now();

      const results  = await measure(def.service, def.routes, baseOptions);
      console.log(results[protocol][def.routeKey]);
      const elapsed  = Date.now() - tStart;
      const resources = await sampler.stop();

      
      crossProto[protocol] = results[protocol];;
      console.log(crossProto);
      output.push(toProtocolMetrics(protocol, def.routeKey, results, elapsed, resources));
    }

    // ── HTML Report ───────────────────────────────────────────────────────────
    if (Object.keys(crossProto).length > 0) {
      console.log('\n⏳ Generazione HTML report...');
      await new Promise(resolve => {
        apiBenchmark.getHtml(crossProto, (htmlErr, html) => {
          if (htmlErr) { console.error('  ⚠ getHtml:', htmlErr); resolve(null); return; }
          try {
            const outPath = path.join(__dirname, '../../public/benchmark/report.html');
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, html);
            console.log(`  ✅ Report salvato in: ${outPath}`);
          } catch (e) {
            console.error('  ⚠ Errore scrittura report:', e.message);
          }
          resolve(null);
        });
      });
    }

    console.log(`\n✅ Benchmark completato — ${output.length} protocolli`);
    res.json({ ok: true, results: output });

  } catch (err) {
    console.error('💥 Benchmark error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    runStatus = 'idle';
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✅ Benchmark server → http://localhost:${PORT}`);
  console.log(`   POST /run    — avvia il benchmark`);
  console.log(`   GET  /status — stato corrente`);
});
