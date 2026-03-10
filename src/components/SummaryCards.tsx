import type { ProtocolMetrics } from '../types/benchmark';
import { PROTOCOL_COLORS, PROTOCOL_DATA } from '../data/protocols';

interface Props { results: ProtocolMetrics[]; }

export function SummaryCards({ results }: Props) {
  if (results.length === 0) return null;

  const fastest    = [...results].sort((a, b) => a.meanLatencyMs   - b.meanLatencyMs)[0];
  const highThr    = [...results].sort((a, b) => b.throughput  - a.throughput)[0];
  const consistent = [...results].sort((a, b) => a.deviationLatencyMs - b.deviationLatencyMs)[0];
  const reliable   = [...results].sort((a, b) => a.errorCount- b.errorCount)[0];

  // Metriche risorse — solo se disponibili
  const withMem = results.filter(r => r.metrics.memory.samples > 0);
  const withCpu = results.filter(r => r.metrics.cpu.samples > 0);
  const lowMem  = withMem.length > 0 ? [...withMem].sort((a, b) => a.metrics.memory.avg - b.metrics.memory.avg)[0] : null;
  const lowCpu  = withCpu.length > 0 ? [...withCpu].sort((a, b) => a.metrics.cpu.avg     - b.metrics.cpu.avg)[0]     : null;

  const cards = [
    { label: '⚡ Fastest',     p: fastest,    value: `${fastest.meanLatencyMs.toFixed(3)} ms`,        sub: 'Client avg latency' },
    { label: '📈 Throughput',  p: highThr,    value: `${highThr.throughput.toFixed(0)} req/s`,   sub: 'Client throughput' },
    { label: '📊 Consistent',  p: consistent, value: `σ ${consistent.deviationLatencyMs.toFixed(3)}`,   sub: 'Std deviation' },
    { label: '🛡️ Reliable',    p: reliable,   value: `${reliable.errorCount.toFixed(1)}%`,                 sub: 'Error rate' },
    ...(lowMem ? [{ label: '🧠 Low Memory', p: lowMem, value: `${lowMem.metrics.memory.avg} MB`,  sub: 'Heap peak (server)' }] : []),
    ...(lowCpu ? [{ label: '⚙️ Low CPU',    p: lowCpu, value: `${lowCpu.metrics.cpu.avg}%`,         sub: 'CPU avg (server)' }]  : []),
  ];

  const cols = cards.length <= 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6';

  return (
    <div className={`grid ${cols} gap-2`}>
      {cards.map(c => {
        const info = PROTOCOL_DATA.find(d => d.name === c.p.protocol);
        return (
          <div key={c.label} className="bg-gray-900 rounded-xl border border-gray-800 p-3 hover:border-gray-700 transition">
            <p className="text-[10px] text-gray-500 mb-1 font-medium uppercase tracking-wider">{c.label}</p>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PROTOCOL_COLORS[c.p.protocol] }} />
              <span className="text-white font-semibold text-xs">{info?.icon} {c.p.protocol}</span>
            </div>
            <p className="text-lg font-bold text-blue-400 font-mono leading-tight">{c.value}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{c.sub}</p>
          </div>
        );
      })}
    </div>
  );
}
