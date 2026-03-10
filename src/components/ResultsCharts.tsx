import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Cell } from 'recharts';
import type { ProtocolMetrics } from '../types/benchmark';
import { PROTOCOL_COLORS } from '../data/protocols';

interface Props { results: ProtocolMetrics[]; }

export function ResultsCharts({ results }: Props) {
  if (results.length === 0) return null;

  const latencyData = results.map(r => ({ name: r.protocol, Avg: r.meanLatencyMs, Median: r.medianLatencyMs, P95: r.p95LatencyMs, P99: r.p99LatencyMs }));
  const throughputData = results.map(r => ({ name: r.protocol, 'req/s': r.throughput, color: PROTOCOL_COLORS[r.protocol] }));

const maxLat = Math.max(...results.map(r => r.meanLatencyMs), 0.001);
const maxThr = Math.max(...results.map(r => r.throughput), 0.001);
const varianceData = results.map(r => ({
    name: r.protocol,
    Min:    Math.min(...r.latencySamples),
    Avg:    r.meanLatencyMs,
    Max:    Math.max(...r.latencySamples),
    StdDev: r.deviationLatencyMs,
    color: PROTOCOL_COLORS[r.protocol],
  }));
const maxJit = Math.max(
  ...results.map(r => r.p99LatencyMs - r.medianLatencyMs),
  0.001
);

const radarData = [
  {
    metric: 'Speed',
    ...Object.fromEntries(
      results.map(r => [
        r.protocol,
        Math.max(0, Math.round((1 - r.meanLatencyMs / maxLat) * 100))
      ])
    )
  },
  {
    metric: 'Throughput',
    ...Object.fromEntries(
      results.map(r => [
        r.protocol,
        Math.round((r.throughput / maxThr) * 100)
      ])
    )
  },
  {
    metric: 'Reliability',
    ...Object.fromEntries(
      results.map(r => [
        r.protocol,
        Math.round((1 - r.errorCount / 100) * 100)
      ])
    )
  },
  {
    metric: 'Consistency',
    ...Object.fromEntries(
      results.map(r => [
        r.protocol,
        Math.max(
          0,
          Math.round((1 - (r.p99LatencyMs - r.medianLatencyMs) / maxJit) * 100)
        )
      ])
    )
  }
];
  const tt = { backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 12, fontSize: 12 };

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <h3 className="text-base font-semibold text-white mb-0.5">⏱️ Client Latency Percentiles (ms)</h3>
        <p className="text-xs text-gray-500 mb-4">Round-trip: payload build → HTTP fetch → response parse</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={latencyData} barGap={1} barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" /><XAxis dataKey="name" stroke="#6b7280" fontSize={11} /><YAxis stroke="#6b7280" fontSize={10} />
            <Tooltip contentStyle={tt} /><Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Avg" fill="#3b82f6" radius={[3,3,0,0]} /><Bar dataKey="Median" fill="#10b981" radius={[3,3,0,0]} />
            <Bar dataKey="P95" fill="#f59e0b" radius={[3,3,0,0]} /><Bar dataKey="P99" fill="#ef4444" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <h3 className="text-base font-semibold text-white mb-0.5">📈 Client Throughput</h3>
          <p className="text-xs text-gray-500 mb-4">Requests per second (measured)</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={throughputData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" /><XAxis dataKey="name" stroke="#6b7280" fontSize={11} /><YAxis stroke="#6b7280" fontSize={10} />
              <Tooltip contentStyle={tt} />
              <Bar dataKey="req/s" radius={[4,4,0,0]}>{throughputData.map((e, i) => <Cell key={i} fill={e.color} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <h3 className="text-base font-semibold text-white mb-0.5">🎯 Overall Score</h3>
          <p className="text-xs text-gray-500 mb-4">Normalized comparison (higher = better)</p>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#1f2937" /><PolarAngleAxis dataKey="metric" stroke="#6b7280" fontSize={10} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#374151" fontSize={9} />
              {results.map(r => <Radar key={r.protocol} name={r.protocol} dataKey={r.protocol} stroke={PROTOCOL_COLORS[r.protocol]} fill={PROTOCOL_COLORS[r.protocol]} fillOpacity={0.08} strokeWidth={2} />)}
              <Legend wrapperStyle={{ fontSize: 10 }} /><Tooltip contentStyle={tt} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <h3 className="text-base font-semibold text-white mb-0.5">📊 Payload & Overhead</h3>
          <p className="text-xs text-gray-500 mb-4">Protocol overhead vs actual payload bytes</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={transferData} barGap={2} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" /><XAxis dataKey="name" stroke="#6b7280" fontSize={11} /><YAxis stroke="#6b7280" fontSize={10} />
              <Tooltip contentStyle={tt} /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Overhead (B)" fill="#f59e0b" radius={[3,3,0,0]} /><Bar dataKey="Avg Payload (B)" fill="#6366f1" radius={[3,3,0,0]} /><Bar dataKey="Avg Response (B)" fill="#10b981" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <h3 className="text-base font-semibold text-white mb-0.5">🔧 Client Time Breakdown (ms)</h3>
          <p className="text-xs text-gray-500 mb-4">Where client-side time is spent per request</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={timingData} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" /><XAxis dataKey="name" stroke="#6b7280" fontSize={11} /><YAxis stroke="#6b7280" fontSize={10} />
              <Tooltip contentStyle={tt} /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Build Payload" stackId="a" fill="#10b981" /><Bar dataKey="Send (Worker IPC)" stackId="a" fill="#3b82f6" /><Bar dataKey="Parse Response" stackId="a" fill="#f59e0b" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div> */}

      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <h3 className="text-base font-semibold text-white mb-0.5">📉 Latency Variance</h3>
        <p className="text-xs text-gray-500 mb-4">Min / Avg / Max / Standard Deviation</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={varianceData} barGap={1} barSize={14}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" /><XAxis dataKey="name" stroke="#6b7280" fontSize={11} /><YAxis stroke="#6b7280" fontSize={10} />
            <Tooltip contentStyle={tt} /><Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Min" fill="#10b981" radius={[3,3,0,0]} /><Bar dataKey="Avg" fill="#3b82f6" radius={[3,3,0,0]} /><Bar dataKey="Max" fill="#ef4444" radius={[3,3,0,0]} /><Bar dataKey="StdDev" fill="#8b5cf6" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
