import type { BenchmarkRun } from '../types/benchmark';

interface Props {
  history: BenchmarkRun[];
  onSelect: (run: BenchmarkRun) => void;
  selectedId: string | null;
  onClear: () => void;
}

export function HistoryPanel({ history, onSelect, selectedId, onClear }: Props) {
  if (history.length === 0) return null;

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">📜 History</h3>
          <p className="text-[10px] text-gray-500">{history.length} run(s)</p>
        </div>
        <button
          onClick={onClear}
          className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/20 hover:border-red-500/40 transition"
        >
          Clear
        </button>
      </div>
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {history.map(run => (
          <button
            key={run.id}
            onClick={() => onSelect(run)}
            className={`w-full text-left px-3 py-2 rounded-lg transition-all border text-xs ${
              selectedId === run.id
                ? 'border-blue-500/50 bg-blue-500/10'
                : 'border-gray-800 bg-gray-800/20 hover:border-gray-700'
            }`}
          >
            <p className="text-white font-medium">
              {run.config.protocols.length} protocols • {run.config.iterations} iter • {run.config.payloadSize}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {new Date(run.timestamp).toLocaleTimeString()} — {run.durationMs.toFixed(0)} ms total
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
