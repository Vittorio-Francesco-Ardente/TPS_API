import type { ProtocolType } from '../types/benchmark';
import { PROTOCOL_COLORS } from '../data/protocols';

interface Props {
  progress: number;
  currentProtocol: ProtocolType | null;
  protocolProgress: number;
}

export function ProgressBar({ progress, currentProtocol, protocolProgress }: Props) {
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-blue-400" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-white font-medium">
            {currentProtocol ? (
              <>
                Benchmarking{' '}
                <span style={{ color: PROTOCOL_COLORS[currentProtocol] }}>{currentProtocol}</span>
                <span className="text-gray-500 ml-1">({Math.round(protocolProgress)}%)</span>
              </>
            ) : (
              'Starting benchmark...'
            )}
          </span>
        </div>
        <span className="text-blue-400 font-bold font-mono text-sm">{Math.round(progress)}%</span>
      </div>
      <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
