import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import type { ProtocolResult } from '../types/benchmark';
import { PROTOCOL_COLORS } from '../data/protocols';

interface Props { results: ProtocolResult[]; }

export function ServerMetrics({ results }: Props) {
  if (results.length === 0) return null;

  const serverTimingData = results.map(r => ({
    name: r.protocol, Parsing: r.avgServerParsingMs, Validation: r.avgServerValidationMs,
    Processing: r.avgServerProcessingMs, Serialization: r.avgServerSerializationMs,
  }));

  const serverLatencyData = results.map(r => ({
    name: r.protocol, Avg: r.serverLatency.avg, Median: r.serverLatency.median,
    P95: r.serverLatency.p95, P99: r.serverLatency.p99,
  }));

  const memoryData = results.map(r => ({ name: r.protocol, 'Avg Memory (KB)': r.avgServerMemoryKB, color: PROTOCOL_COLORS[r.protocol] }));

  const serverThroughputData = results.map(r => ({ name: r.protocol, 'Server req/s': r.serverThroughputRps, 'Client req/s': r.clientThroughputRps, color: PROTOCOL_COLORS[r.protocol] }));

  const bandwidthData = results.map(r => {
    const totalBytes = r.totalBytesSent + r.totalBytesReceived;
    const kbps = r.totalClientDurationMs > 0 ? (totalBytes / 1024) / (r.totalClientDurationMs / 1000) : 0;
    return { name: r.protocol, 'KB/s': Math.round(kbps * 100) / 100, color: PROTOCOL_COLORS[r.protocol] };
  });

  const maxSamples = Math.min(50, ...results.map(r => r.samples.length));
  const timelineData = Array.from({ length: maxSamples }, (_, i) => {
    const point: Record<string, number | string> = { sample: `#${i + 1}` };
    results.forEach(r => { if (r.samples[i]) point[r.protocol] = Math.round(r.samples[i].server.totalServerMs * 1000) / 1000; });
    return point;
  });

  const tt = { backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 12, fontSize: 12 };

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <h3 className="text-base font-semibold text-white mb-0.5">🖥️ Server Processing Breakdown (ms)</h3>
        <p className="text-xs text-gray-500 mb-4">Measured inside each Web Worker — parsing → validation → processing → serialization</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={serverTimingData} barSize={24}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" /><XAxis dataKey="name" stroke="#6b7280" fontSize={11} /><YAxis stroke="#6b7280" fontSize={10} />
            <Tooltip contentStyle={tt} /><Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Parsing" stackId="a" fill="#3b82f6" /><Bar dataKey="Validation" stackId="a" fill="#8b5cf6" />
            <Bar dataKey="Processing" stackId="a" fill="#10b981" /><Bar dataKey="Serialization" stackId="a" fill="#f59e0b" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <h3 className="text-base font-semibold text-white mb-0.5">⏱️ Server Latency Percentiles (ms)</h3>
        <p className="text-xs text-gray-500 mb-4">Total server-side processing time per request (excludes IPC)</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={serverLatencyData} barGap={1} barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" /><XAxis dataKey="name" stroke="#6b7280" fontSize={11} /><YAxis stroke="#6b7280" fontSize={10} />
            <Tooltip contentStyle={tt} /><Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Avg" fill="#3b82f6" radius={[3,3,0,0]} /><Bar dataKey="Median" fill="#10b981" radius={[3,3,0,0]} />
            <Bar dataKey="P95" fill="#f59e0b" radius={[3,3,0,0]} /><Bar dataKey="P99" fill="#ef4444" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <h3 className="text-base font-semibold text-white mb-0.5">📊 Throughput Comparison</h3>
          <p className="text-xs text-gray-500 mb-4">Server vs Client throughput (req/s)</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={serverThroughputData} barGap={4} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" /><XAxis dataKey="name" stroke="#6b7280" fontSize={11} /><YAxis stroke="#6b7280" fontSize={10} />
              <Tooltip contentStyle={tt} /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Server req/s" fill="#10b981" radius={[4,4,0,0]} /><Bar dataKey="Client req/s" fill="#3b82f6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <h3 className="text-base font-semibold text-white mb-0.5">💾 Server Memory Usage</h3>
          <p className="text-xs text-gray-500 mb-4">Average memory per request (KB)</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={memoryData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" /><XAxis dataKey="name" stroke="#6b7280" fontSize={11} /><YAxis stroke="#6b7280" fontSize={10} />
              <Tooltip contentStyle={tt} />
              <Bar dataKey="Avg Memory (KB)" radius={[4,4,0,0]}>{memoryData.map((e, i) => <Cell key={i} fill={e.color} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <h3 className="text-base font-semibold text-white mb-0.5">📡 Bandwidth Usage</h3>
        <p className="text-xs text-gray-500 mb-4">Actual KB/s based on total bytes transferred / total time</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={bandwidthData} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" /><XAxis dataKey="name" stroke="#6b7280" fontSize={11} /><YAxis stroke="#6b7280" fontSize={10} />
            <Tooltip contentStyle={tt} />
            <Bar dataKey="KB/s" radius={[4,4,0,0]}>{bandwidthData.map((e, i) => <Cell key={i} fill={e.color} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {timelineData.length > 0 && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <h3 className="text-base font-semibold text-white mb-0.5">📉 Server Latency Per Sample</h3>
          <p className="text-xs text-gray-500 mb-4">Server-side processing time per iteration (first {maxSamples})</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" /><XAxis dataKey="sample" stroke="#6b7280" fontSize={9} interval={Math.floor(maxSamples / 10)} /><YAxis stroke="#6b7280" fontSize={10} />
              <Tooltip contentStyle={tt} /><Legend wrapperStyle={{ fontSize: 10 }} />
              {results.map(r => <Line key={r.protocol} type="monotone" dataKey={r.protocol} stroke={PROTOCOL_COLORS[r.protocol]} strokeWidth={1.5} dot={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
