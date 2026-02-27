import { PROTOCOL_DATA } from '../data/protocols';

export function ProtocolCards() {
  return (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
        <h3 className="text-base font-semibold text-white mb-0.5">📚 Protocol Reference</h3>
        <p className="text-xs text-gray-500">Each protocol is implemented as a real server in a separate Web Worker</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {PROTOCOL_DATA.map(p => (
          <div key={p.name} className="bg-gray-900 rounded-2xl border border-gray-800 p-4 hover:border-gray-700 transition">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="text-2xl">{p.icon}</span>
              <div>
                <h4 className="text-white font-bold">{p.name}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-8 h-0.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-[10px] text-gray-500">{p.format}</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">{p.description}</p>
            <div className="flex gap-2 mb-3 text-[10px] flex-wrap">
              <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700/50">{p.transport}</span>
              <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700/50">{p.format}</span>
            </div>
            <div className="mb-3 p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
              <h5 className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-0.5">🔧 Server Implementation</h5>
              <p className="text-[11px] text-gray-400">{p.serverDetails}</p>
            </div>
            <div className="space-y-2.5">
              <div>
                <h5 className="text-[10px] font-semibold text-green-400 uppercase tracking-wider mb-1">✅ Strengths</h5>
                <ul className="space-y-0.5">{p.pros.map((pro, i) => <li key={i} className="text-[11px] text-gray-300 flex items-start gap-1"><span className="text-green-500 mt-0.5 text-[8px]">●</span>{pro}</li>)}</ul>
              </div>
              <div>
                <h5 className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1">❌ Weaknesses</h5>
                <ul className="space-y-0.5">{p.cons.map((con, i) => <li key={i} className="text-[11px] text-gray-300 flex items-start gap-1"><span className="text-red-500 mt-0.5 text-[8px]">●</span>{con}</li>)}</ul>
              </div>
              <div className="pt-2 border-t border-gray-800/50">
                <h5 className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-0.5">🎯 Best For</h5>
                <p className="text-[11px] text-gray-300">{p.bestFor}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
