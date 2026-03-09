'use strict';

process.on('uncaughtException', (err) => {
  console.error('\n💥 uncaughtException:', err.constructor.name, '-', err.message);
  console.error(err.stack);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('\n💥 unhandledRejection:', reason instanceof Error ? reason.stack : reason);
  process.exit(1);
});
process.on('exit', (code) => {
  console.log('\n[EXIT] codice:', code, '— callback ricevuta:', callbackRicevuta);
});

const fs   = require('fs');
const path = require('path');

var callbackRicevuta = false;

// ── verifica patch ──────────────────────────────────────────────────────────
const LIB = path.join(__dirname, '..', 'node_modules', 'api-benchmark', 'lib');

function check(file, keyword, shouldHave) {
  const src = fs.readFileSync(path.join(LIB, file), 'utf8');
  const has = src.includes(keyword);
  const ok  = has === shouldHave;
  console.log(`  ${ok ? '✅' : '❌'} ${file}`);
  return ok;
}

console.log('\n🔍 Verifica patch:');
const ok1 = check('runner.js',             'setImmediate',    true);
const ok2 = check('grpc-request-agent.js', "text: 'gRPC response'", true);
if (!ok1 || !ok2) { console.error('❌ patch mancante'); process.exit(1); }

// ── stampa il runner.js per vedere ESATTAMENTE cosa c'è ────────────────────
console.log('\n📄 runner.js — righe con setImmediate / runSample / runNextSample:');
const runnerSrc = fs.readFileSync(path.join(LIB, 'runner.js'), 'utf8');
runnerSrc.split('\n').forEach((l, i) => {
  if (l.includes('setImmediate') || l.includes('runNextSample') || l.includes('runSample'))
    console.log(`  ${String(i+1).padStart(3)}: ${l.replace(/\r/,'')}`);
});

// ── test diretto gRPC senza api-benchmark ─────────────────────────────────
// Prima verifichiamo che il server risponda
console.log('\n🔌 Test diretto gRPC (senza api-benchmark)...');
const grpc        = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const PROTO       = path.join(LIB, 'grpc-benchmark.proto');
const pd  = protoLoader.loadSync(PROTO, { keepCase:true, longs:String, enums:String, defaults:true, oneofs:true });
const bm  = grpc.loadPackageDefinition(pd).benchmark;
const cli = new bm.BenchmarkService('localhost:3003', grpc.credentials.createInsecure());

cli.Call({ method: 'HealthCheck', payload: Buffer.from('{}') }, (err, res) => {
  if (err) {
    console.error('   ❌ gRPC diretto fallito:', err.code, err.message);
    process.exit(1);
  }
  console.log('   ✅ gRPC diretto OK — status:', res.status);

  // ── ora testiamo api-benchmark con keepAlive forzato ──────────────────
  console.log('\n⏳ Test api-benchmark.measure() con 1 sample...');

  // Teniamo vivo il processo con un interval — se la callback non arriva
  // entro 10 secondi, stampiamo un errore
  var watchdog = setTimeout(() => {
    console.error('   ⏰ TIMEOUT: callback non arrivata dopo 10s');
    console.error('   → api-benchmark non sta chiamando la callback');
    process.exit(2);
  }, 10000);
  watchdog.unref(); // non impedisce l'uscita normale

  const apiBenchmark = require('api-benchmark');

  apiBenchmark.measure(
    { gRPC: 'grpc://localhost:3003' },
    { HealthCheck: { protocol: 'grpc', method: 'HealthCheck', expectedStatusCode: 0 } },
    { runMode: 'sequence', minSamples: 1, maxTime: 5, delay: 0, stopOnError: false, debug: false },
    (err, results) => {
      callbackRicevuta = true;
      clearTimeout(watchdog);
      console.log('   ✅ Callback ricevuta!');
      if (err)     console.log('   ⚠  err:', JSON.stringify(err));
      if (results) console.log('   📊 keys:', Object.keys(results));
      console.log('\n✅ Test completato.');
    }
  );

  console.log('   [dopo measure() — event loop ha setImmediate in coda?]');
});
