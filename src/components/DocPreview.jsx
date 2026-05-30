function formatTS(secs) {
  if (secs == null) return "00:00"
  return `${Math.floor(secs / 60).toString().padStart(2, "0")}:${Math.floor(secs % 60).toString().padStart(2, "0")}`
}

const SECTION_COLORS = [
  'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  'text-blue-400 bg-blue-500/10 border-blue-500/30',
  'text-amber-400 bg-amber-500/10 border-amber-500/30',
  'text-purple-400 bg-purple-500/10 border-purple-500/30',
  'text-rose-400 bg-rose-500/10 border-rose-500/30',
]

function parseSteps(text) {
  if (!text) return null
  const stepsMatch = text.match(/STEPS?:\s*([\s\S]*?)(?=RESULT:|$)/i)
  const resultMatch = text.match(/RESULT:\s*([\s\S]*)$/i)
  if (!stepsMatch) return null
  const steps = stepsMatch[1]
    .split('\n')
    .map(l => l.replace(/^[\d\-\*•]+[\.\):\s]+/, '').trim())
    .filter(l => l.length > 3)
  return steps.length > 0 ? { steps, result: resultMatch?.[1]?.trim() ?? null } : null
}

function StepsAnnotation({ annotation }) {
  const parsed = parseSteps(annotation)
  if (!parsed) return (
    <p className="text-zinc-500 text-xs leading-relaxed italic mt-1.5 line-clamp-3">{annotation}</p>
  )
  return (
    <div className="mt-2 border border-zinc-700 rounded-lg overflow-hidden text-xs">
      <div className="bg-teal-900/30 text-teal-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border-b border-zinc-700">
        How to do this
      </div>
      {parsed.steps.map((step, i) => (
        <div key={i} className="flex items-start gap-2 px-2.5 py-1.5 border-b border-zinc-800/60 last:border-b-0">
          <span className="w-4 h-4 rounded-full bg-teal-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
          <p className="text-zinc-300 leading-relaxed">{step}</p>
        </div>
      ))}
      {parsed.result && (
        <div className="flex items-start gap-2 px-2.5 py-1.5 bg-amber-900/20 border-t border-zinc-700">
          <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">✓</span>
          <p className="text-amber-300 leading-relaxed">{parsed.result}</p>
        </div>
      )}
    </div>
  )
}

function SectionedAnnotation({ sectionedAnnotation }) {
  const entries = Object.entries(sectionedAnnotation)
  return (
    <div className="space-y-1.5 mt-2">
      {entries.map(([section, content], i) => (
        <div key={section} className={`border rounded-lg px-2.5 py-1.5 ${SECTION_COLORS[i % SECTION_COLORS.length]}`}>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 block mb-0.5">{section}</span>
          <p className="text-xs leading-relaxed opacity-90">{content}</p>
        </div>
      ))}
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
    const hasSections = annotatedDocs.some(d => d.sectionedAnnotation)
    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex flex-col" style={{ maxHeight: "65vh" }}>
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide">
            {hasSections ? 'Structured Docs' : 'Annotated Docs'}
          </p>
          <span className="text-xs text-emerald-400">{annotatedDocs.length} segments</span>
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
                <p className="text-zinc-200 text-xs leading-relaxed line-clamp-2">{doc.text}</p>
                {doc.sectionedAnnotation ? (
                  <SectionedAnnotation sectionedAnnotation={doc.sectionedAnnotation} />
                ) : doc.annotation ? (
                  <StepsAnnotation annotation={doc.annotation} />
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
