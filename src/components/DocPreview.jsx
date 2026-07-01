import { useState, useMemo } from "react"
import { evaluateDoc } from "../lib/evalDoc"

function formatTS(secs) {
  if (secs == null) return "00:00"
  return `${Math.floor(secs / 60).toString().padStart(2, "0")}:${Math.floor(secs % 60).toString().padStart(2, "0")}`
}

// ── "To verify" detection ──
// Acronyms (BW, EET, KWS, R&D, SAC…) are the things a reader most often needs to
// check — the AI or the transcript can get them wrong. We highlight them and list
// them so the user can confirm or fix each one. A few everyday ones are ignored.
const ACR_STOP = new Set(["OK", "AI", "NO", "ID", "TV", "PC", "IT", "OS", "UI", "UX", "FAQ", "SOP", "PDF"])
const ACR_RE = /\b[A-Z][A-Z0-9&/]{1,5}\b/g
function isAcr(a) { return a && !ACR_STOP.has(a) }

function collectAcronyms(docs) {
  const counts = new Map()
  const scan = (s) => {
    if (typeof s !== "string") return
    const ms = s.match(ACR_RE)
    if (ms) for (const a of ms) if (isAcr(a)) counts.set(a, (counts.get(a) || 0) + 1)
  }
  for (const d of docs || []) {
    const st = d.step
    if (!st) continue
    scan(st.title); (st.steps || []).forEach(scan); scan(st.result); scan(st.note)
  }
  return counts
}

// Render text, wrapping unverified acronyms in a clickable amber chip.
function Highlighted({ text, verified, onClickAcr }) {
  if (!text) return null
  const out = []
  let last = 0, m
  const re = new RegExp(ACR_RE.source, "g")
  while ((m = re.exec(text))) {
    const a = m[0]
    if (!isAcr(a)) continue
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(verified.has(a)
      ? <span key={m.index} className="text-emerald-300/90">{a}</span>
      : <mark
          key={m.index}
          onClick={(e) => { e.stopPropagation(); onClickAcr?.(a) }}
          className="bg-amber-400/20 text-amber-200 rounded px-0.5 cursor-pointer ring-1 ring-amber-400/40 hover:bg-amber-400/30 transition-colors"
          title="Click to verify or fix"
        >{a}</mark>)
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return <>{out}</>
}

// ── Inline editor for one step ──
function StepEditor({ step, onSave, onCancel }) {
  const [title, setTitle] = useState(step?.title || "")
  const [lines, setLines] = useState(step?.steps?.length ? [...step.steps] : [""])
  const [result, setResult] = useState(step?.result || "")
  const [note, setNote] = useState(step?.note || "")

  const setLine = (i, v) => setLines(ls => ls.map((l, idx) => idx === i ? v : l))
  const addLine = () => setLines(ls => [...ls, ""])
  const delLine = (i) => setLines(ls => ls.filter((_, idx) => idx !== i).length ? ls.filter((_, idx) => idx !== i) : [""])

  const field = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 leading-relaxed focus:outline-none focus:border-emerald-500"
  const label = "text-[11px] uppercase tracking-wider text-zinc-400 font-medium mb-1 block"

  return (
    <div className="mt-2 border border-emerald-700/50 rounded-xl p-4 space-y-3.5 bg-zinc-900 shadow-lg animate-[fadeIn_.15s_ease-out]">
      <div>
        <label className={label}>Title</label>
        <input className={field} value={title} onChange={e => setTitle(e.target.value)} placeholder="Step title" />
      </div>
      <div>
        <label className={label}>Actions</label>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-2">{i + 1}</span>
              <textarea className={field + " resize-y min-h-[42px]"} rows={2} value={l} onChange={e => setLine(i, e.target.value)} />
              <button onClick={() => delLine(i)} className="text-zinc-500 hover:text-red-400 text-xl leading-none px-2 py-1.5 mt-1 rounded hover:bg-red-500/10 transition-colors" title="Remove this action">×</button>
            </div>
          ))}
        </div>
        <button onClick={addLine} className="text-sm text-emerald-400 hover:text-emerald-300 font-medium mt-2 px-1 py-1">+ Add action</button>
      </div>
      <div>
        <label className={label}>Result</label>
        <input className={field} value={result} onChange={e => setResult(e.target.value)} placeholder="What you get (optional)" />
      </div>
      <div>
        <label className={label}>Note</label>
        <input className={field} value={note} onChange={e => setNote(e.target.value)} placeholder="Tip / warning (optional)" />
      </div>
      <div className="flex gap-2 pt-1.5">
        <button
          onClick={() => onSave({ ...step, title: title.trim(), steps: lines.map(l => l.trim()).filter(Boolean), result: result.trim(), note: note.trim() })}
          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-semibold transition-colors">Save changes</button>
        <button onClick={onCancel} className="px-5 py-2.5 border border-zinc-700 hover:border-zinc-500 rounded-lg text-sm transition-colors">Cancel</button>
      </div>
    </div>
  )
}

// Read-only step view with acronym highlighting. Click the title bar to edit.
function StepView({ step, verified, onClickAcr, onEdit }) {
  if (!step) return null
  return (
    <div className="mt-2 border border-zinc-700 rounded-lg overflow-hidden text-xs">
      {step.title && (
        <div
          onClick={onEdit}
          className="bg-teal-900/30 text-teal-300 px-2.5 py-2 text-[12px] font-semibold border-b border-zinc-700 flex items-center justify-between gap-2 cursor-text hover:bg-teal-900/45 transition-colors"
          title="Click to edit this step">
          <span className="min-w-0"><Highlighted text={step.title} verified={verified} onClickAcr={onClickAcr} /></span>
          {onEdit && <span className="text-emerald-400/70 text-[10px] shrink-0">✎ edit</span>}
        </div>
      )}
      {step.steps?.map((s, i) => (
        <div key={i} className="flex items-start gap-2 px-2.5 py-1.5 border-b border-zinc-800/60 last:border-b-0">
          <span className="w-4 h-4 rounded-full bg-teal-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
          <p className="text-zinc-300 leading-relaxed"><Highlighted text={s} verified={verified} onClickAcr={onClickAcr} /></p>
        </div>
      ))}
      {step.result && (
        <div className="flex items-start gap-2 px-2.5 py-1.5 bg-emerald-900/20 border-t border-zinc-800/60">
          <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">✓</span>
          <p className="text-emerald-300 leading-relaxed"><Highlighted text={step.result} verified={verified} onClickAcr={onClickAcr} /></p>
        </div>
      )}
      {step.note && (
        <div className="flex items-start gap-2 px-2.5 py-1.5 bg-amber-900/15 border-t border-zinc-800/60">
          <span className="w-4 h-4 rounded-full bg-amber-600/80 text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">!</span>
          <p className="text-amber-200/90 leading-relaxed italic"><Highlighted text={step.note} verified={verified} onClickAcr={onClickAcr} /></p>
        </div>
      )}
    </div>
  )
}

export default function DocPreview({ transcriptChunks, annotatedDocs, onSeek, onEditStep, onMoveStep, onDeleteStep, onReplaceEverywhere }) {
  const hasAnnotations = annotatedDocs?.length > 0
  const hasTranscript = transcriptChunks?.length > 0

  const [editing, setEditing] = useState(null)        // index being edited
  const [verified, setVerified] = useState(() => new Set())
  const [showVerify, setShowVerify] = useState(false)
  const [drafts, setDrafts] = useState({})            // acronym -> replacement text
  const [lightbox, setLightbox] = useState(null)      // enlarged screenshot {src, label}

  const acronyms = useMemo(() => collectAcronyms(annotatedDocs), [annotatedDocs])
  const evalResult = useMemo(() => evaluateDoc(annotatedDocs), [annotatedDocs])
  const toVerify = useMemo(() => [...acronyms.keys()].filter(a => !verified.has(a)), [acronyms, verified])

  if (!hasTranscript && !hasAnnotations) {
    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 min-h-64 flex items-center justify-center">
        <p className="text-zinc-600 text-sm text-center">Docs will appear here<br />after video is processed</p>
      </div>
    )
  }

  if (hasAnnotations) {
    const markGood = (a) => setVerified(v => new Set(v).add(a))
    const applyReplace = (a) => {
      const repl = (drafts[a] ?? "").trim()
      if (repl && repl !== a) onReplaceEverywhere?.(a, repl)
      markGood(a)
      setDrafts(d => { const n = { ...d }; delete n[a]; return n })
    }
    const openVerify = (a) => { setShowVerify(true); setDrafts(d => ({ ...d, [a]: d[a] ?? "" })) }

    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex flex-col" style={{ maxHeight: "65vh" }}>
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0 gap-2">
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide">Procedure Steps · <span className="text-zinc-400 normal-case">tap any step to edit</span></p>
          <div className="flex items-center gap-2 shrink-0">
            <span
              title={`Self-check (no manual answer key): ${evalResult.unclearRate}% steps unclear · ${evalResult.logisticsSteps} noise steps · apps named: ${evalResult.appsNamed.join(', ') || 'none'}`}
              className={`text-xs px-2 py-1 rounded-full ring-1 ${
                evalResult.score >= 75 ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40' :
                evalResult.score >= 50 ? 'bg-amber-500/15 text-amber-300 ring-amber-500/40' :
                'bg-red-500/15 text-red-300 ring-red-500/40'}`}>
              Self-check {evalResult.score}/100
            </span>
            {toVerify.length > 0 && (
              <button onClick={() => setShowVerify(s => !s)}
                className="text-xs px-2 py-1 rounded-full bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40 hover:bg-amber-500/25 transition-colors">
                ⚠ {toVerify.length} to verify
              </button>
            )}
            <span className="text-xs text-emerald-400">{annotatedDocs.length} steps</span>
          </div>
        </div>

        {/* Verify panel */}
        {showVerify && toVerify.length > 0 && (
          <div className="px-4 py-3 border-b border-zinc-800 bg-amber-950/10 max-h-48 overflow-y-auto animate-[fadeIn_.15s_ease-out]">
            <p className="text-[11px] text-amber-200/80 mb-2">Check these short codes / acronyms. Fix once → it changes everywhere.</p>
            <div className="space-y-1.5">
              {toVerify.map(a => (
                <div key={a} className="flex items-center gap-1.5">
                  <span className="text-xs font-mono bg-amber-400/15 text-amber-200 rounded px-1.5 py-0.5 ring-1 ring-amber-400/30 shrink-0">{a}</span>
                  <span className="text-[10px] text-zinc-500 shrink-0">×{acronyms.get(a)}</span>
                  <input
                    value={drafts[a] ?? ""}
                    onChange={e => setDrafts(d => ({ ...d, [a]: e.target.value }))}
                    placeholder="correct it (optional)"
                    className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-amber-500" />
                  {(drafts[a] ?? "").trim() && (drafts[a] ?? "").trim() !== a
                    ? <button onClick={() => applyReplace(a)} className="text-[11px] px-2 py-1 bg-emerald-600 hover:bg-emerald-500 rounded transition-colors shrink-0">Replace all</button>
                    : <button onClick={() => markGood(a)} className="text-[11px] px-2 py-1 border border-zinc-600 hover:border-emerald-500 text-zinc-300 rounded transition-colors shrink-0">Looks good</button>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-y-auto divide-y divide-zinc-800/60">
          {annotatedDocs.map((doc, i) => (
            <div key={i} className="p-4 flex gap-3 group">
              {/* Thumbnail: image click enlarges (80px tells you nothing about a
                  dense enterprise UI); the timestamp underneath seeks the video */}
              <div className="shrink-0 w-20">
                {doc.frame ? (
                  <button onClick={() => setLightbox({ src: doc.frame, label: `Step ${i + 1} · ${doc.label}` })} title="Click to enlarge" className="block w-full cursor-zoom-in">
                    <img src={doc.frame} alt="" className="w-20 h-12 object-cover rounded-lg opacity-75 group-hover:opacity-100 transition-opacity" />
                  </button>
                ) : (
                  <div className="w-20 h-12 rounded-lg bg-zinc-800 flex items-center justify-center"><span className="text-zinc-600 text-xs font-mono">{doc.label}</span></div>
                )}
                <button onClick={() => onSeek?.(doc.timestamp, i)} title="Jump to this moment in the video"
                  className="block w-full text-center text-emerald-400 hover:text-emerald-300 font-mono text-xs mt-1 transition-colors">{doc.label}</button>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                    Step {i + 1}
                    {doc.lowConfidence && (
                      <span title="Written from thin evidence (little narration and little readable screen text at this moment). Worth a quick review."
                        className="inline-block w-2 h-2 rounded-full bg-amber-400/80 ring-2 ring-amber-400/25 cursor-help" />
                    )}
                  </span>
                  {editing !== i && doc.step && (
                    <div className="flex items-center gap-1">
                      {/* Reorder + remove: the human editing the doc has the final say */}
                      <button onClick={() => onMoveStep?.(i, -1)} disabled={i === 0} title="Move up"
                        className="text-[11px] text-zinc-400 hover:text-zinc-200 disabled:opacity-25 disabled:cursor-default ring-1 ring-zinc-700 hover:ring-zinc-500 rounded-full w-6 h-6 flex items-center justify-center transition-colors">↑</button>
                      <button onClick={() => onMoveStep?.(i, 1)} disabled={i === annotatedDocs.length - 1} title="Move down"
                        className="text-[11px] text-zinc-400 hover:text-zinc-200 disabled:opacity-25 disabled:cursor-default ring-1 ring-zinc-700 hover:ring-zinc-500 rounded-full w-6 h-6 flex items-center justify-center transition-colors">↓</button>
                      <button onClick={() => { if (window.confirm(`Remove step ${i + 1} "${doc.step.title || ''}" from the document?`)) onDeleteStep?.(i) }} title="Remove step"
                        className="text-[11px] text-red-400/70 hover:text-red-300 ring-1 ring-zinc-700 hover:ring-red-500/50 rounded-full w-6 h-6 flex items-center justify-center transition-colors">✕</button>
                      <button onClick={() => setEditing(i)} className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 ring-1 ring-emerald-500/30 rounded-full px-2.5 py-1 transition-colors ml-1">✎ Edit</button>
                    </div>
                  )}
                </div>
                {editing === i && doc.step ? (
                  <StepEditor step={doc.step} onSave={(ns) => { onEditStep?.(i, ns); setEditing(null) }} onCancel={() => setEditing(null)} />
                ) : doc.step ? (
                  <StepView step={doc.step} verified={verified} onClickAcr={openVerify} onEdit={() => setEditing(i)} />
                ) : doc.annotation ? (
                  <p className="text-zinc-400 text-xs leading-relaxed mt-1.5 line-clamp-3">{doc.annotation}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* Screenshot lightbox — dense enterprise UIs are unreadable at 80px */}
        {lightbox && (
          <div className="fixed inset-0 z-[60] bg-black/85 flex flex-col items-center justify-center p-6 cursor-zoom-out"
            onClick={() => setLightbox(null)}>
            <img src={lightbox.src} alt="" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs text-zinc-300 font-mono">{lightbox.label}</span>
              <span className="text-xs text-zinc-500">click anywhere to close</span>
            </div>
          </div>
        )}
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
            <span className="text-emerald-400 font-mono text-xs shrink-0 mt-0.5">{formatTS(chunk.timestamp?.[0])}</span>
            <p className="text-zinc-300 text-sm leading-relaxed">{chunk.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
