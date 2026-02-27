import type { ProtocolResult } from '../types/benchmark';
import { PROTOCOL_COLORS, PROTOCOL_DATA } from '../data/protocols';

interface Props { results: ProtocolResult[]; }

export function SummaryCards({ results }: Props) {
  if (results.length === 0) return null;
  const fastest = [...results].sort((a, b) => a.clientLatency.avg - b.clientLatency.avg)[0];
  const highThr = [...results].sort((a, b) => b.clientThroughputRps - a.clientThroughputRps)[0];
  const leastOvh = [...results].sort((a, b) => a.protocolOverheadBytes - b.protocolOverheadBytes)[0];
  const reliable = [...results].sort((a, b) => a.errorRate - b.errorRate)[0];
  const consistent = [...results].sort((a, b) => a.clientLatency.stdDev - b.clientLatency.stdDev)[0];
  const smallTx = [...results].sort((a, b) => a.avgPayloadSizeBytes - b.avgPayloadSizeBytes)[0];
  const fastSrv = [...results].sort((a, b) => a.serverLatency.avg - b.serverLatency.avg)[0];
  const fmtBytes = (b: number) => b > 1024 ? `${(b / 1024).toFixed(1)} KB` : `${Math.round(b)} B`;

  const cards = [
    { label: '⚡ Fastest', p: fastest, value: `${fastest.clientLatency.avg.toFixed(3)} ms`, sub: 'Client avg latency' },
    { label: '📈 Throughput', p: highThr, value: `${highThr.clientThroughputRps.toFixed(0)} req/s`, sub: 'Client throughput' },
    { label: '🖥️ Server', p: fastSrv, value: `${fastSrv.serverLatency.avg.toFixed(3)} ms`, sub: 'Server avg latency' },
    { label: '📦 Lightest', p: leastOvh, value: `${leastOvh.protocolOverheadBytes} B`, sub: 'Protocol overhead' },
    { label: '📊 Consistent', p: consistent, value: `σ ${consistent.clientLatency.stdDev.toFixed(3)}`, sub: 'Std deviation' },
    { label: '📡 Smallest', p: smallTx, value: fmtBytes(smallTx.avgPayloadSizeBytes), sub: 'Avg payload' },
    { label: '🛡️ Reliable', p: reliable, value: `${reliable.errorRate.toFixed(1)}%`, sub: 'Error rate' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
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
