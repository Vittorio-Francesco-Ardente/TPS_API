import { useState, useCallback } from 'react';
import type { BenchmarkConfig, BenchmarkRun, ProtocolResult, ProtocolType } from './types/benchmark';
import { runFullBenchmark } from './engine/benchmark';
import { ConfigPanel } from './components/ConfigPanel';
import { ResultsCharts } from './components/ResultsCharts';
import { ServerMetrics } from './components/ServerMetrics';
import { ResultsTable } from './components/ResultsTable';
import { SummaryCards } from './components/SummaryCards';
import { ProtocolCards } from './components/ProtocolCards';
import { ProgressBar } from './components/ProgressBar';
import { HistoryPanel } from './components/HistoryPanel';

type TabType = 'client' | 'server' | 'table' | 'protocols';

export function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentProtocol, setCurrentProtocol] = useState<ProtocolType | null>(null);
  const [protocolProgress, setProtocolProgress] = useState(0);
  const [currentResults, setCurrentResults] = useState<ProtocolResult[]>([]);
  const [history, setHistory] = useState<BenchmarkRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('client');

  const handleRun = useCallback(async (config: BenchmarkConfig) => {
    setIsRunning(true);
    setProgress(0);
    setCurrentResults([]);
    setActiveTab('client');
    const startTime = performance.now();
    try {
      const results = await runFullBenchmark(config, (overall, proto, protoPct, partial) => {
        setProgress(overall);
        setCurrentProtocol(proto);
        setProtocolProgress(protoPct);
        setCurrentResults([...partial]);
      });
      const run: BenchmarkRun = {
        id: crypto.randomUUID(), timestamp: Date.now(), config, results, status: 'completed',
        durationMs: performance.now() - startTime,
      };
      setHistory(prev => [run, ...prev]);
      setSelectedRunId(run.id);
      setCurrentResults(results);
    } catch (err) {
      console.error('Benchmark failed:', err);
    } finally {
      setIsRunning(false);
      setProgress(100);
      setCurrentProtocol(null);
    }
  }, []);

  const handleSelectRun = useCallback((run: BenchmarkRun) => {
    setSelectedRunId(run.id);
    setCurrentResults(run.results);
  }, []);

  const hasResults = currentResults.length > 0;
  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'client', label: 'Client Metrics', icon: '📱' },
    { id: 'server', label: 'Server Metrics', icon: '🖥️' },
    { id: 'table', label: 'Data Table', icon: '📋' },
    { id: 'protocols', label: 'Protocol Guide', icon: '📚' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-950/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-base shadow-lg shadow-blue-500/20">⚡</div>
              <div>
                <h1 className="text-base font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">API Protocol Benchmark</h1>
                <p className="text-[10px] text-gray-500">6 real Web Worker servers • No simulated data</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-gray-500">
              <span className="px-2 py-1 rounded bg-gray-800/80 border border-gray-700/50">Web Workers</span>
              <span className="px-2 py-1 rounded bg-gray-800/80 border border-gray-700/50">performance.now()</span>
              <span className="px-2 py-1 rounded bg-gray-800/80 border border-gray-700/50">Real Servers</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 xl:col-span-3 space-y-4">
            <ConfigPanel onRun={handleRun} isRunning={isRunning} />
            <HistoryPanel history={history} onSelect={handleSelectRun} selectedId={selectedRunId} onClear={() => { setHistory([]); setSelectedRunId(null); }} />
          </div>
          <div className="lg:col-span-8 xl:col-span-9 space-y-4">
            {isRunning && <ProgressBar progress={progress} currentProtocol={currentProtocol} protocolProgress={protocolProgress} />}
            {hasResults && !isRunning && <SummaryCards results={currentResults} />}
            {(hasResults || activeTab === 'protocols') && (
              <div className="flex gap-0.5 bg-gray-900 rounded-xl p-0.5 border border-gray-800">
                {tabs.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all ${activeTab === tab.id ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:text-gray-400 hover:bg-gray-800/30'}`}>
                    <span className="hidden sm:inline">{tab.icon} </span>{tab.label}
                  </button>
                ))}
              </div>
            )}
            {activeTab === 'client' && hasResults && <ResultsCharts results={currentResults} />}
            {activeTab === 'server' && hasResults && <ServerMetrics results={currentResults} />}
            {activeTab === 'table' && hasResults && <ResultsTable results={currentResults} />}
            {activeTab === 'protocols' && <ProtocolCards />}
            {!hasResults && !isRunning && activeTab !== 'protocols' && (
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-10 text-center">
                <div className="text-5xl mb-3">🔬</div>
                <h3 className="text-lg font-bold text-white mb-1">No Data Yet</h3>
                <p className="text-sm text-gray-400 max-w-lg mx-auto mb-5">
                  Configure parameters and run the benchmark. Each protocol runs in its own <strong>Web Worker server</strong> — 
                  a real server implementation with parsing, validation, processing, and serialization. All timings measured with{' '}
                  <code className="text-blue-400 text-xs bg-gray-800 px-1 py-0.5 rounded">performance.now()</code>.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-md mx-auto">
                  {[
                    { n: 'REST', d: 'JSON + HTTP routing', i: '🌐' },
                    { n: 'GraphQL', d: 'Query parsing + resolvers', i: '◈' },
                    { n: 'gRPC', d: 'Protobuf binary encode/decode', i: '⚡' },
                    { n: 'SOAP', d: 'XML DOMParser + envelope', i: '📦' },
                    { n: 'MQTT', d: 'Binary packet broker', i: '📡' },
                    { n: 'Webhooks', d: 'Signature verification + dispatch', i: '🔔' },
                  ].map(p => (
                    <div key={p.n} className="px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700/50 text-left">
                      <div className="text-xs text-white font-medium">{p.i} {p.n}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{p.d}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="border-t border-gray-800/50 mt-8 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-[10px] text-gray-600 leading-relaxed">
            Each protocol has its own Web Worker server: REST (JSON API), GraphQL (query parser + resolvers), gRPC (Protobuf binary encoding), 
            SOAP (XML DOMParser), MQTT (binary packet broker), Webhooks (HMAC signature verification). 
            Client measures payload build + IPC round-trip + response parsing. Server measures parsing + validation + processing + serialization. 
            No data is generated until you run the benchmark.
          </p>
        </div>
      </footer>
    </div>
  );
}
