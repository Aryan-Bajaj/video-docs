function formatTS(secs) {
  if (secs == null) return "00:00"
  return `${Math.floor(secs / 60).toString().padStart(2, "0")}:${Math.floor(secs % 60).toString().padStart(2, "0")}`
}

// Render a parsed procedure step (doc.step): title + ordered actions + result + note.
function StepView({ step }) {
  if (!step) return null
  const hasActions = step.steps?.length > 0
  return (
    <div className="mt-2 border border-zinc-700 rounded-lg overflow-hidden text-xs">
      {step.title && (
        <div className="bg-teal-900/30 text-teal-300 px-2.5 py-1.5 text-[11px] font-semibold border-b border-zinc-700">{step.title}</div>
      )}
      {hasActions && step.steps.map((s, i) => (
        <div key={i} className="flex items-start gap-2 px-2.5 py-1.5 border-b border-zinc-800/60 last:border-b-0">
          <span className="w-4 h-4 rounded-full bg-teal-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
          <p className="text-zinc-300 leading-relaxed">{s}</p>
        </div>
      ))}
      {step.result && (
        <div className="flex items-start gap-2 px-2.5 py-1.5 bg-emerald-900/20 border-t border-zinc-800/60">
          <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">✓</span>
          <p className="text-emerald-300 leading-relaxed">{step.result}</p>
        </div>
      )}
      {step.note && (
        <div className="flex items-start gap-2 px-2.5 py-1.5 bg-amber-900/15 border-t border-zinc-800/60">
          <span className="w-4 h-4 rounded-full bg-amber-600/80 text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">!</span>
          <p className="text-amber-200/90 leading-relaxed italic">{step.note}</p>
        </div>
      )}
    </div>
  )
}

export default function DocPreview({ transcriptChunks, annotatedDocs, onSeek }) {
  const hasAnnotations = annotatedDocs?.length > 0
  const hasTranscript = transcriptChunks?.length > 0

  if (!hasTranscript && !hasAnnotations) {
    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 min-h-64 flex items-center justify-center">
        <p className="text-zinc-600 text-sm text-center">
          Docs will appear here<br />after video is processed
        </p>
      </div>
    )
  }

  if (hasAnnotations) {
    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex flex-col" style={{ maxHeight: "65vh" }}>
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide">
            Procedure Steps
          </p>
          <span className="text-xs text-emerald-400">{annotatedDocs.length} steps</span>
        </div>

        <div className="overflow-y-auto divide-y divide-zinc-800/60">
          {annotatedDocs.map((doc, i) => (
            <button
              key={i}
              onClick={() => onSeek?.(doc.timestamp, i)}
              className="w-full text-left p-4 hover:bg-zinc-800/50 transition-colors flex gap-3 group"
            >
              {/* Thumbnail */}
              <div className="shrink-0 w-20">
                {doc.frame ? (
                  <img src={doc.frame} alt=""
                    className="w-20 h-12 object-cover rounded-lg opacity-75 group-hover:opacity-100 transition-opacity" />
                ) : (
                  <div className="w-20 h-12 rounded-lg bg-zinc-800 flex items-center justify-center">
                    <span className="text-zinc-600 text-xs font-mono">{doc.label}</span>
                  </div>
                )}
                <span className="block text-center text-emerald-400 font-mono text-xs mt-1">{doc.label}</span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Step {i + 1}</span>
                {doc.step ? (
                  <StepView step={doc.step} />
                ) : doc.annotation ? (
                  <p className="text-zinc-400 text-xs leading-relaxed mt-1.5 line-clamp-3">{doc.annotation}</p>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Transcript only
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex flex-col" style={{ maxHeight: "65vh" }}>
      <div className="px-4 py-3 border-b border-zinc-800 shrink-0">
        <p className="text-xs text-zinc-500">Transcript — use "Annotate" to add AI notes</p>
      </div>
      <div className="overflow-y-auto p-4 space-y-3">
        {transcriptChunks.map((chunk, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-emerald-400 font-mono text-xs shrink-0 mt-0.5">
              {formatTS(chunk.timestamp?.[0])}
            </span>
            <p className="text-zinc-300 text-sm leading-relaxed">{chunk.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
