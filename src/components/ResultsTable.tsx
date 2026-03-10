import type { ProtocolMetrics } from '../types/benchmark';
import { PROTOCOL_COLORS, PROTOCOL_DATA } from '../data/protocols';

interface Props { results: ProtocolMetrics[]; }

export function ResultsTable({ results }: Props) {
  if (results.length === 0) return null;

  // Score basato solo su metriche reali
  const score = (r: ProtocolMetrics) => {
    const maxL   = Math.max(...results.map(x => x.meanLatencyMs),    0.001);
    const maxT   = Math.max(...results.map(x => x.throughput),  0.001);
    const maxJit = Math.max(...results.map(x => x.deviationLatencyMs), 0.001);
    const maxMem = results.some(x => x.metrics.memory.samples > 0)
      ? Math.max(...results.filter(x => x.metrics.memory.samples > 0).map(x => x.metrics.memory.peak), 1)
      : 1;
    const maxCpu = results.some(x => x.metrics.cpu.samples > 0)
      ? Math.max(...results.filter(x => x.metrics.cpu.samples > 0).map(x => x.metrics.cpu.avg), 1)
      : 1;

    const hasRes = r.metrics.memory.samples > 0 || r.metrics.cpu.samples > 0;
    const speedScore       = (1 - r.meanLatencyMs   / maxL)   * 30;
    const throughputScore  = (r.throughput      / maxT)   * 25;
    const consistencyScore = (1 - r.deviationLatencyMs / maxJit) * 15;
    const reliabilityScore = (1 - r.errorCount / 100)               * 10;
    const memScore         = hasRes ? (1 - r.metrics.memory.peak / maxMem) * 10 : 5;
    const cpuScore         = hasRes ? (1 - r.metrics.cpu.avg     / maxCpu) * 10 : 5;

    return Math.round(speedScore + throughputScore + consistencyScore + reliabilityScore + memScore + cpuScore);
  };

  const sorted = [...results].sort((a, b) => score(b) - score(a));
  const fmt = (n: number, d = 3) => n.toFixed(d);
  const best  = (vals: number[], lower: boolean) => lower ? Math.min(...vals) : Math.max(...vals);
  const worst = (vals: number[], lower: boolean) => lower ? Math.max(...vals) : Math.min(...vals);
  const cc = (v: number, b: number, w: number) =>
    v === b ? 'text-green-400 font-semibold' : v === w ? 'text-red-400 font-semibold' : 'text-gray-300';

  const cAvgs = results.map(r => r.meanLatencyMs);
  const cThrs = results.map(r => r.throughput);
  const memPs = results.filter(r => r.metrics.memory.samples > 0).map(r => r.metrics.memory.peak);
  const cpuAs = results.filter(r => r.metrics.cpu.samples > 0).map(r => r.metrics.cpu.avg);

  const hasResources = results.some(r => r.metrics.memory.samples > 0 || r.metrics.cpu.samples > 0);

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
      <h3 className="text-base font-semibold text-white mb-0.5">📋 Detailed Results</h3>
      <p className="text-xs text-gray-500 mb-4">
        <span className="text-green-400">■</span> best{' '}
        <span className="text-red-400">■</span> worst — latenza e throughput via performance.now(), memoria/CPU da /metrics
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700/50">
              <th className="text-left py-2 px-2 text-gray-500 font-medium">#</th>
              <th className="text-left py-2 px-2 text-gray-500 font-medium">Protocol</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">Avg (ms)</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">P50</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">P95</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">P99</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">σ</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">req/s</th>
              {hasResources && <>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">Heap Peak</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">CPU Avg</th>
              </>}
              <th className="text-right py-2 px-2 text-gray-500 font-medium">Err%</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const info = PROTOCOL_DATA.find(d => d.name === r.protocol);
              const s = score(r);
              return (
                <tr key={r.protocol} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition">
                  <td className="py-2.5 px-2">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold
                      ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-gray-400/20 text-gray-300' : i === 2 ? 'bg-amber-700/20 text-amber-600' : 'bg-gray-800 text-gray-500'}`}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </span>
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PROTOCOL_COLORS[r.protocol] }} />
                      <span className="text-white font-medium">{info?.icon} {r.protocol}</span>
                    </div>
                  </td>
                  <td className={`py-2.5 px-2 text-right font-mono ${cc(r.meanLatencyMs, best(cAvgs, true), worst(cAvgs, true))}`}>{fmt(r.meanLatencyMs)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-gray-400">{fmt(r.medianLatencyMs)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-gray-400">{fmt(r.p95LatencyMs)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-gray-400">{fmt(r.p99LatencyMs)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-gray-400">{fmt(r.deviationLatencyMs)}</td>
                  <td className={`py-2.5 px-2 text-right font-mono ${cc(r.throughput, best(cThrs, false), worst(cThrs, false))}`}>{fmt(r.throughput, 0)}</td>
                  {hasResources && <>
                    <td className={`py-2.5 px-2 text-right font-mono ${r.metrics.memory.samples > 0 && memPs.length > 1 ? cc(r.metrics.memory.peak, best(memPs, true), worst(memPs, true)) : 'text-gray-500'}`}>
                      {r.metrics.memory.samples > 0 ? `${r.metrics.memory.peak} MB` : '—'}
                    </td>
                    <td className={`py-2.5 px-2 text-right font-mono ${r.metrics.cpu.samples > 0 && cpuAs.length > 1 ? cc(r.metrics.cpu.avg, best(cpuAs, true), worst(cpuAs, true)) : 'text-gray-500'}`}>
                      {r.metrics.cpu.samples > 0 ? `${r.metrics.cpu.avg}%` : '—'}
                    </td>
                  </>}
                  <td className="py-2.5 px-2 text-right font-mono text-gray-400">{fmt(r.errorCount, 1)}%</td>
                  <td className="py-2.5 px-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-12 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(0, s)}%`, backgroundColor: s > 70 ? '#10b981' : s > 40 ? '#f59e0b' : '#ef4444' }} />
                      </div>
                      <span className={`font-bold font-mono ${s > 70 ? 'text-green-400' : s > 40 ? 'text-yellow-400' : 'text-red-400'}`}>{s}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 pt-3 border-t border-gray-800">
        <p className="text-[10px] text-gray-600">
          Score = 30% speed + 25% throughput + 15% consistency + 10% reliability
          {hasResources ? ' + 10% low memory + 10% low CPU' : ' (memoria/CPU N/A — /metrics non raggiungibile)'}.
        </p>
      </div>
    </div>
  );
}
