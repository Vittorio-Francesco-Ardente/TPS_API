import type { ProtocolResult } from '../types/benchmark';
import { PROTOCOL_COLORS, PROTOCOL_DATA } from '../data/protocols';

interface Props { results: ProtocolResult[]; }

export function ResultsTable({ results }: Props) {
  if (results.length === 0) return null;

  const score = (r: ProtocolResult) => {
    const maxL = Math.max(...results.map(x => x.clientLatency.avg), 0.001);
    const maxT = Math.max(...results.map(x => x.clientThroughputRps), 0.001);
    const maxO = Math.max(...results.map(x => x.protocolOverheadBytes), 1);
    const maxS = Math.max(...results.map(x => x.serverLatency.avg), 0.001);
    return Math.round(
      (1 - r.clientLatency.avg / maxL) * 25 + (r.clientThroughputRps / maxT) * 25 +
      (1 - r.protocolOverheadBytes / maxO) * 20 + (1 - r.serverLatency.avg / maxS) * 20 +
      (1 - r.errorRate / 100) * 10
    );
  };

  const sorted = [...results].sort((a, b) => score(b) - score(a));
  const fmt = (n: number, d = 3) => n.toFixed(d);
  const fmtS = (b: number) => b > 1024 ? `${(b / 1024).toFixed(1)} KB` : `${Math.round(b)} B`;

  const best = (vals: number[], lower: boolean) => lower ? Math.min(...vals) : Math.max(...vals);
  const worst = (vals: number[], lower: boolean) => lower ? Math.max(...vals) : Math.min(...vals);
  const cc = (v: number, b: number, w: number) => v === b ? 'text-green-400 font-semibold' : v === w ? 'text-red-400 font-semibold' : 'text-gray-300';

  const cAvgs = results.map(r => r.clientLatency.avg);
  const cThrs = results.map(r => r.clientThroughputRps);
  const sAvgs = results.map(r => r.serverLatency.avg);

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
      <h3 className="text-base font-semibold text-white mb-0.5">📋 Detailed Results</h3>
      <p className="text-xs text-gray-500 mb-4"><span className="text-green-400">■</span> best <span className="text-red-400">■</span> worst — all values measured via performance.now()</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700/50">
              <th className="text-left py-2 px-2 text-gray-500 font-medium">#</th>
              <th className="text-left py-2 px-2 text-gray-500 font-medium">Protocol</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">Client Avg</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">P50</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">P95</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">P99</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">σ</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">Server Avg</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">req/s</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">Overhead</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">Payload</th>
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
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-gray-400/20 text-gray-300' : i === 2 ? 'bg-amber-700/20 text-amber-600' : 'bg-gray-800 text-gray-500'}`}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </span>
                  </td>
                  <td className="py-2.5 px-2"><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: PROTOCOL_COLORS[r.protocol] }} /><span className="text-white font-medium">{info?.icon} {r.protocol}</span></div></td>
                  <td className={`py-2.5 px-2 text-right font-mono ${cc(r.clientLatency.avg, best(cAvgs, true), worst(cAvgs, true))}`}>{fmt(r.clientLatency.avg)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-gray-400">{fmt(r.clientLatency.median)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-gray-400">{fmt(r.clientLatency.p95)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-gray-400">{fmt(r.clientLatency.p99)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-gray-400">{fmt(r.clientLatency.stdDev)}</td>
                  <td className={`py-2.5 px-2 text-right font-mono ${cc(r.serverLatency.avg, best(sAvgs, true), worst(sAvgs, true))}`}>{fmt(r.serverLatency.avg)}</td>
                  <td className={`py-2.5 px-2 text-right font-mono ${cc(r.clientThroughputRps, best(cThrs, false), worst(cThrs, false))}`}>{fmt(r.clientThroughputRps, 0)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-gray-400">{fmtS(r.protocolOverheadBytes)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-gray-400">{fmtS(r.avgPayloadSizeBytes)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-gray-400">{fmt(r.errorRate, 1)}%</td>
                  <td className="py-2.5 px-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-12 h-1.5 rounded-full bg-gray-800 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(0, s)}%`, backgroundColor: s > 70 ? '#10b981' : s > 40 ? '#f59e0b' : '#ef4444' }} /></div>
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
        <p className="text-[10px] text-gray-600">Score = 25% client speed + 25% throughput + 20% overhead efficiency + 20% server speed + 10% reliability. All measurements via separate Web Worker servers with performance.now().</p>
      </div>
    </div>
  );
}
