import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, Cell, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import React from 'react';
import type { ProtocolMetrics} from '../types/benchmark';
import { PROTOCOL_COLORS } from '../data/protocols';

interface Props { results: ProtocolMetrics[]; }

const tt = { backgroundColor: '#0a0f1a', border: '1px solid #1e293b', borderRadius: 10, fontSize: 12 };

// ── Reusable card wrapper ────────────────────────────────────────────────────
function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
      <h3 className="text-sm font-semibold text-white mb-0.5">{title}</h3>
      {sub && <p className="text-[11px] text-gray-500 mb-4">{sub}</p>}
      {!sub && <div className="mb-4" />}
      {children}
    </div>
  );
}

// ── "N/A" badge when /metrics not available ──────────────────────────────────
function UnavailableBadge() {
  return (
    <div className="flex items-center justify-center h-40 text-gray-600 text-sm flex-col gap-2">
      <span className="text-2xl">📡</span>
      <span>Server /metrics non raggiungibile</span>
      <span className="text-[10px] text-gray-700">Avvia i server con <code>npm run start:servers</code></span>
    </div>
  );
}

export function MetricsPanel({ results }: Props) {
  if (results.length === 0) return null;

  // ── 1. Client Latency Percentiles ────────────────────────────────────────
  const latencyData = results.map(r => ({
    name: r.protocol,
    Avg:    r.meanLatencyMs,
    Median: r.medianLatencyMs,
    P95:    r.p95LatencyMs,
    P99:    r.p99LatencyMs,
  }));

  // ── 2. Client Throughput ─────────────────────────────────────────────────
  const throughputData = results.map(r => ({
    name: r.protocol,
    'req/s': r.throughput,
    color: PROTOCOL_COLORS[r.protocol],
  }));

  // ── 3. Latency Variance ──────────────────────────────────────────────────
  const varianceData = results.map(r => ({
    name: r.protocol,
    Min:    Math.min(...r.latencySamples),
    Avg:    r.meanLatencyMs,
    Max:    Math.max(...r.latencySamples),
    StdDev: r.deviationLatencyMs,
    color: PROTOCOL_COLORS[r.protocol],
  }));

  // ── 4. Latency timeline ──────────────────────────────────────────────────
  const maxSamples = Math.min(60, ...results.map(r => r.latencySamples.length));
  const timelineData = Array.from({ length: maxSamples }, (_, i) => {
    const point: Record<string, number | string> = { sample: `#${i + 1}` };
    results.forEach(r => {
      if (r.latencySamples[i]) point[r.protocol] = Math.round(r.latencySamples[i] * 1000) / 1000;
    });
    return point;
  });

  // ── 5. Memory (heap) ─────────────────────────────────────────────────────
  const hasMemory = results.some(r => r.metrics.memory.samples > 0);
  const memPeakData = results.map(r => ({
    name: r.protocol,
    'Heap Peak (MB)': r.metrics.memory.peak,
    'Heap Avg (MB)':  r.metrics.memory.avg  ,
    color: PROTOCOL_COLORS[r.protocol],
  }));

  // ── 6. CPU ───────────────────────────────────────────────────────────────
  const hasCpu = results.some(r => r.metrics.cpu.samples > 0);
  const cpuData = results.map(r => ({
    name: r.protocol,
    'CPU Peak (%)': r.metrics.cpu.peak,
    'CPU Avg (%)':  r.metrics.cpu.avg  ,
    color: PROTOCOL_COLORS[r.protocol],
  }));

  // ── 7. Radar — solo metriche reali ──────────────────────────────────────
  const maxLat = Math.max(...results.map(r => r.meanLatencyMs), 0.001);
  const maxThr = Math.max(...results.map(r => r.throughput), 0.001);
  const maxJit = Math.max(...results.map(r => r.p99LatencyMs - r.medianLatencyMs), 0.001);
  const maxMem = hasMemory ? Math.max(...results.filter(r => r.metrics.memory.samples > 0).map(r => r.metrics.memory.peak), 1) : 1;
  const maxCpu = hasCpu    ? Math.max(...results.filter(r => r.metrics.cpu.samples > 0).map(r => r.metrics.cpu.peak),    1) : 1;

  const radarData = [
    { metric: 'Speed',       ...Object.fromEntries(results.map(r => [r.protocol, Math.max(0, Math.round((1 - r.meanLatencyMs / maxLat) * 100))])) },
    { metric: 'Throughput',  ...Object.fromEntries(results.map(r => [r.protocol, Math.round((r.throughput / maxThr) * 100)])) },
    { metric: 'Consistency', ...Object.fromEntries(results.map(r => [r.protocol, Math.max(0, Math.round((1 - (r.p99LatencyMs - r.medianLatencyMs) / maxJit) * 100))])) },
    { metric: 'Reliability', ...Object.fromEntries(results.map(r => [r.protocol, Math.round((1 - r.errorCount / 100) * 100)])) },
    ...(hasMemory ? [{ metric: 'Low Memory', ...Object.fromEntries(results.map(r => [r.protocol, r.metrics.memory.samples > 0 ? Math.max(0, Math.round((1 - r.metrics.memory.peak / maxMem) * 100)) : 50])) }] : []),
    ...(hasCpu    ? [{ metric: 'Low CPU',    ...Object.fromEntries(results.map(r => [r.protocol, r.metrics.cpu.samples > 0 ? Math.max(0, Math.round((1 - r.metrics.cpu.peak / maxCpu)    * 100)) : 50])) }] : []),
  ];

  return (
    <div className="space-y-4">

      {/* ── Row 1: Latency + Throughput ── */}
      <Card title="⏱️ Client Latency Percentiles (ms)" sub="Round-trip reale: build → fetch → parse risposta">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={latencyData} barGap={1} barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="name" stroke="#6b7280" fontSize={11} />
            <YAxis stroke="#6b7280" fontSize={10} />
            <Tooltip contentStyle={tt} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Avg"    fill="#3b82f6" radius={[3,3,0,0]} />
            <Bar dataKey="Median" fill="#10b981" radius={[3,3,0,0]} />
            <Bar dataKey="P95"    fill="#f59e0b" radius={[3,3,0,0]} />
            <Bar dataKey="P99"    fill="#ef4444" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <Card title="📈 Throughput (req/s)" sub="Richieste al secondo misurate lato client">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={throughputData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={10} />
              <Tooltip contentStyle={tt} />
              <Bar dataKey="req/s" radius={[4,4,0,0]}>
                {throughputData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="📉 Latency Variance" sub="Min / Avg / Max / Deviazione standard">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={varianceData} barGap={1} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={10} />
              <Tooltip contentStyle={tt} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Min"    fill="#10b981" radius={[3,3,0,0]} />
              <Bar dataKey="Avg"    fill="#3b82f6" radius={[3,3,0,0]} />
              <Bar dataKey="Max"    fill="#ef4444" radius={[3,3,0,0]} />
              <Bar dataKey="StdDev" fill="#8b5cf6" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

      </div>

      {/* ── Row 2: Memory ── */}
      <Card
        title="🧠 Server Memory — Heap Used (MB)"
        sub={hasMemory
          ? `Misurato in tempo reale da /metrics`
          : undefined}
      >
        {hasMemory ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={memPeakData} barGap={4} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={10} unit=" MB" />
              <Tooltip contentStyle={tt} formatter={(value: number | undefined, name) => [
                value !== undefined ? `${value} MB` : "N/A",
                name
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Heap Peak (MB)" fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="Heap Avg (MB)"  fill="#06b6d4" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <UnavailableBadge />}
      </Card>

      {/* ── Row 3: CPU ── */}
      <Card
        title="⚙️ Server CPU Usage (% normalizzata)"
        sub={hasCpu
          ? `Percentuale CPU normalizzata su tutti i core — sempre ≤ 100%`
          : undefined}
      >
        {hasCpu ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={cpuData} barGap={4} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={10} unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={tt} formatter={(value: number | undefined, name) => [
                value !== undefined ? `${value} %` : "N/A",
                name
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="CPU Peak (%)" fill="#f59e0b" radius={[4,4,0,0]} />
              <Bar dataKey="CPU Avg (%)"  fill="#fbbf24" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <UnavailableBadge />}
      </Card>

      {/* ── Row 4: Radar + Timeline ── */}


        {timelineData.length > 0 && (
          <Card title="📉 Latency Per Sample" sub={`Andamento round-trip per iterazione (prime ${maxSamples})`}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="sample" stroke="#6b7280" fontSize={9} interval={Math.floor(maxSamples / 8)} />
                <YAxis stroke="#6b7280" fontSize={10} unit=" ms" />
                <Tooltip contentStyle={tt} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {results.map(r => (
                  <Line
                    key={r.protocol}
                    type="monotone"
                    dataKey={r.protocol}
                    stroke={PROTOCOL_COLORS[r.protocol]}
                    strokeWidth={1.5}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}
    </div>
  );
}
