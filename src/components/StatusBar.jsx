function formatETA(ms) {
  if (!ms || ms <= 0) return null
  const s = Math.round(ms / 1000)
  if (s < 5) return null
  if (s < 60) return `~${s}s left`
  return `~${Math.ceil(s / 60)}m left`
}

export default function StatusBar({ message, pct, etaMs, step, total }) {
  const isIndeterminate = pct === null || pct === undefined
  const eta = formatETA(etaMs)

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <span className="text-sm text-zinc-300 truncate">{message}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500 shrink-0 ml-4">
          {step !== undefined && total !== undefined && (
            <span>{step}/{total}</span>
          )}
          {!isIndeterminate && <span className="text-emerald-400 font-mono">{pct}%</span>}
          {eta && <span>{eta}</span>}
        </div>
      </div>

      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        {isIndeterminate ? (
          <div className="h-full w-full relative">
            <div className="absolute h-full w-1/3 bg-emerald-500 rounded-full animate-[indeterminate_1.4s_ease-in-out_infinite]" />
          </div>
        ) : (
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        )}
      </div>
    </div>
  )
}
