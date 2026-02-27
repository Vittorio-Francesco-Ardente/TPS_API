import { useState } from 'react';
import type { BenchmarkConfig, ProtocolType } from '../types/benchmark';
import { PROTOCOL_DATA } from '../data/protocols';

interface Props { onRun: (config: BenchmarkConfig) => void; isRunning: boolean; }

const ALL_PROTOCOLS: ProtocolType[] = ['REST', 'GraphQL', 'gRPC', 'SOAP', 'MQTT', 'Webhooks'];

export function ConfigPanel({ onRun, isRunning }: Props) {
  const [selected, setSelected] = useState<ProtocolType[]>([...ALL_PROTOCOLS]);
  const [iterations, setIterations] = useState(50);
  const [payloadSize, setPayloadSize] = useState<BenchmarkConfig['payloadSize']>('medium');
  const [concurrency, setConcurrency] = useState(5);
  const [warmup, setWarmup] = useState(3);
  const [delay, setDelay] = useState(0);
  const [showAdv, setShowAdv] = useState(false);

  const toggle = (p: ProtocolType) => setSelected(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const run = () => {
    if (selected.length === 0) return;
    onRun({ protocols: selected, iterations, payloadSize, concurrency, warmupIterations: warmup, delayBetweenMs: delay });
  };

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white mb-0.5">⚙️ Configuration</h2>
        <p className="text-[10px] text-gray-500">Each protocol runs in a separate Web Worker server</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Protocols</label>
        <div className="grid grid-cols-2 gap-1.5">
          {ALL_PROTOCOLS.map(p => {
            const info = PROTOCOL_DATA.find(d => d.name === p)!;
            const sel = selected.includes(p);
            return (
              <button key={p} onClick={() => toggle(p)} disabled={isRunning}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${sel ? 'border-blue-500/50 bg-blue-500/10 text-white' : 'border-gray-700/50 bg-gray-800/30 text-gray-500 hover:border-gray-600'} ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <span>{info.icon}</span><span>{p}</span>
                {sel && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: info.color }} />}
              </button>
            );
          })}
        </div>
        <button className="mt-1.5 text-xs text-gray-500 hover:text-gray-400 transition" disabled={isRunning}
          onClick={() => setSelected(selected.length === ALL_PROTOCOLS.length ? [] : [...ALL_PROTOCOLS])}>
          {selected.length === ALL_PROTOCOLS.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Iterations: <span className="text-blue-400 font-mono">{iterations}</span></label>
        <input type="range" min={5} max={500} step={5} value={iterations} onChange={e => setIterations(Number(e.target.value))} className="w-full accent-blue-500" disabled={isRunning} />
        <div className="flex justify-between text-[10px] text-gray-600 mt-0.5"><span>5</span><span>250</span><span>500</span></div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Payload Size</label>
        <div className="flex gap-1 flex-wrap">
          {([
            { v: 'tiny' as const, l: '16 B' }, { v: 'small' as const, l: '64 B' },
            { v: 'medium' as const, l: '1 KB' }, { v: 'large' as const, l: '8 KB' }, { v: 'huge' as const, l: '64 KB' },
          ]).map(({ v, l }) => (
            <button key={v} onClick={() => setPayloadSize(v)} disabled={isRunning}
              className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${payloadSize === v ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-gray-700/50 bg-gray-800/30 text-gray-500 hover:border-gray-600'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Concurrency: <span className="text-blue-400 font-mono">{concurrency}</span></label>
        <input type="range" min={1} max={50} value={concurrency} onChange={e => setConcurrency(Number(e.target.value))} className="w-full accent-blue-500" disabled={isRunning} />
      </div>
      <div>
        <button onClick={() => setShowAdv(!showAdv)} className="text-xs text-gray-500 hover:text-gray-400 transition flex items-center gap-1">
          <span className={`transition-transform ${showAdv ? 'rotate-90' : ''}`}>▶</span> Advanced
        </button>
        {showAdv && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Warmup iterations: <span className="text-blue-400 font-mono">{warmup}</span></label>
              <input type="range" min={0} max={20} value={warmup} onChange={e => setWarmup(Number(e.target.value))} className="w-full accent-blue-500" disabled={isRunning} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Delay between batches (ms): <span className="text-blue-400 font-mono">{delay}</span></label>
              <input type="range" min={0} max={100} value={delay} onChange={e => setDelay(Number(e.target.value))} className="w-full accent-blue-500" disabled={isRunning} />
            </div>
          </div>
        )}
      </div>
      <button onClick={run} disabled={isRunning || selected.length === 0}
        className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${isRunning || selected.length === 0 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-500 hover:to-cyan-400 shadow-lg shadow-blue-500/20 active:scale-[0.98]'}`}>
        {isRunning ? <span className="flex items-center justify-center gap-2"><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Running...</span> : `🚀 Run Benchmark (${selected.length} protocols)`}
      </button>
    </div>
  );
}
