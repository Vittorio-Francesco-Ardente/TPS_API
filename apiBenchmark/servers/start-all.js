/**
 * start-all.js
 * Avvia tutti e 4 i server in processi separati
 */
const { spawn } = require('child_process');
const path = require('path');

const servers = [
  { name: 'REST     (3001)', file: 'rest-server.js',     port: 3001 },
  { name: 'GraphQL  (3002)', file: 'graphql-server.js',  port: 3002 },
  { name: 'gRPC     (3003)', file: 'grpc-server.js',     port: 3003 },
];

const colors = ['\x1b[32m', '\x1b[34m', '\x1b[35m', '\x1b[36m', '\x1b[33m', '\x1b[31m'];
const reset = '\x1b[0m';

console.log('🚀 Avvio di tutti i server...\n');

const processes = servers.map((server, i) => {
  const color = colors[i % colors.length];
  const prefix = `${color}[${server.name}]${reset}`;

  const proc = spawn('node', [path.join(__dirname, server.file)], {
    stdio: 'pipe',
    env: { ...process.env }
  });

  proc.stdout.on('data', data => {
    data.toString().trim().split('\n').forEach(line => {
      console.log(`${prefix} ${line}`);
    });
  });

  proc.stderr.on('data', data => {
    data.toString().trim().split('\n').forEach(line => {
      console.error(`${prefix} \x1b[31m${line}${reset}`);
    });
  });

  proc.on('exit', (code) => {
    console.log(`${prefix} \x1b[31mTerminato con codice ${code}${reset}`);
  });

  return proc;
});

// Gestione segnale di terminazione
process.on('SIGINT', () => {
  console.log('\n\n🛑 Arresto di tutti i server...');
  processes.forEach(p => p.kill('SIGTERM'));
  setTimeout(() => process.exit(0), 1000);
});

console.log('\n📋 Riepilogo server:');
servers.forEach((s, i) => {
  console.log(`  ${colors[i]}● ${s.name}  →  http://localhost:${s.port}${reset}`);
});
console.log('\n💡 Premi Ctrl+C per fermare tutti i server');
console.log('💡 Dopo 5s esegui: node benchmark/run-benchmark.js\n');
