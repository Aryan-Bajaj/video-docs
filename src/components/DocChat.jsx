import { useState, useCallback, useEffect } from "react"
import useRAG from "../hooks/useRAG"
import { MessageSquare, Send, CornerDownRight, Sparkles, Globe } from "lucide-react"

function fmt(ts) {
  if (ts == null) return ""
  const m = Math.floor(ts / 60).toString().padStart(2, "0")
  const s = Math.floor(ts % 60).toString().padStart(2, "0")
  return `${m}:${s}`
}

// Live progress block — replaces the dead "…thinking" with the actual phase
// (searching → loading model X% → writing answer) so the user sees it moving.
function Progress({ status }) {
  if (!status) return null
  const { label, pct, phase } = status
  const showPct = typeof pct === "number" && pct > 0 && pct < 100
  const text = phase === "ready" ? "Writing the answer..." : label
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs text-zinc-200">
        <span className="w-3.5 h-3.5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin shrink-0" />
        <span className="truncate">{text}</span>
        {showPct && <span className="ml-auto text-emerald-400 font-mono font-semibold">{pct}%</span>}
      </div>
      <div className="mt-2 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        {showPct ? (
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        ) : (
          <div className="h-full w-1/3 bg-emerald-500 rounded-full animate-[indeterminate_1.4s_ease-in-out_infinite]" />
        )}
      </div>
      {phase === "download" && (
        <p className="text-[11px] text-zinc-500 mt-1.5">First run downloads the browser AI once, then it stays cached.</p>
      )}
    </div>
  )
}

export default function DocChat({ docs, aiMode, ollamaModel, onSeek, autoStart = false }) {
  const { buildIndex, ask, askGeneral, isReady } = useRAG()
  const [open, setOpen] = useState(autoStart)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState(null) // { label, pct, phase } | null
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState([]) // {q, a, sources}
  const [openSrc, setOpenSrc] = useState(null) // "msgIdx-srcIdx" of an expanded doc source

  const onStatus = useCallback((label, pct = null, phase = null) => {
    setStatus(label ? { label, pct, phase } : null)
  }, [])

  const ensureIndex = useCallback(async () => {
    if (ready || isReady()) { setReady(true); return }
    onStatus("Indexing the document...", null, "index")
    await buildIndex(docs, onStatus)
    setStatus(null)
    setReady(true)
  }, [ready, isReady, buildIndex, docs, onStatus])

  const handleOpen = async () => {
    setOpen(true)
    setBusy(true)
    try { await ensureIndex() } catch (e) { onStatus(e.message) } finally { setBusy(false) }
  }

  // Auto-start: as soon as the document is ready, build the knowledge index in
  // the background (don't wait for the user to ask) so the first answer is fast.
  useEffect(() => {
    if (!autoStart || !docs?.length || ready || isReady()) return
    let cancelled = false
    setBusy(true)
    ;(async () => {
      try { await ensureIndex() } catch (e) { if (!cancelled) onStatus(e.message) }
      finally { if (!cancelled) setBusy(false) }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, docs])

  const submit = async () => {
    const q = input.trim()
    if (!q || busy) return
    setInput("")
    setBusy(true)
    setMessages((m) => [...m, { q, a: null, sources: [] }])
    try {
      await ensureIndex()
      const { answer, sources, notFound } = await ask(q, aiMode || "webllm", ollamaModel, onStatus)
      setMessages((m) => m.map((x, i) => i === m.length - 1 ? { ...x, a: answer, sources, notFound: !!notFound, query: q } : x))
    } catch (e) {
      setMessages((m) => m.map((x, i) => i === m.length - 1 ? { ...x, a: `⚠️ ${e.message}` } : x))
    } finally {
      setBusy(false); setStatus(null)
    }
  }

  // Document doesn't cover it → answer from the model's own general knowledge.
  const answerFromAI = async (idx, q) => {
    if (busy) return
    setBusy(true)
    setMessages((m) => m.map((x, i) => i === idx ? { ...x, notFound: false } : x))
    try {
      const a = await askGeneral(q, aiMode || "webllm", ollamaModel, onStatus)
      setMessages((m) => m.map((x, i) => i === idx ? { ...x, a, sources: [], general: true } : x))
    } catch (e) {
      setMessages((m) => m.map((x, i) => i === idx ? { ...x, a: `⚠️ ${e.message}`, notFound: true } : x))
    } finally {
      setBusy(false); setStatus(null)
    }
  }

  // Hand off to a real web search (real sources, opens in a new tab).
  const searchWeb = (q) => {
    window.open(`https://www.perplexity.ai/search?q=${encodeURIComponent(q)}`, "_blank", "noopener,noreferrer")
  }

  if (!docs?.length) return null

  if (!open) {
    return (
      <button onClick={handleOpen}
        className="w-full border border-emerald-700/40 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-xl px-4 py-3 flex items-center gap-3 transition-all">
        <MessageSquare className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-medium text-emerald-300">Vid Chat</span>
        <span className="text-xs text-zinc-500 ml-auto">Ask anything · answers cite the exact step</span>
      </button>
    )
  }

  return (
    <div className="border border-zinc-700 rounded-xl overflow-hidden flex flex-col bg-zinc-900 shadow-xl" style={{ maxHeight: 520 }}>
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2 bg-zinc-900">
        <MessageSquare className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-semibold text-white">Vid Chat</span>
        {busy && <span className="text-xs text-emerald-400 ml-auto">Working...</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950">
        {messages.length === 0 && !busy && (
          <p className="text-xs text-zinc-500">e.g. “What is this all about?” · “Which tools are used?” · “How do I run the macro?”</p>
        )}

        {/* Indexing progress before the first question */}
        {messages.length === 0 && busy && status && <Progress status={status} />}

        {messages.map((m, i) => {
          const isLast = i === messages.length - 1
          return (
            <div key={i} className="space-y-2">
              <div className="text-sm text-zinc-100"><span className="text-emerald-400 font-semibold">You: </span>{m.q}</div>
              {m.a != null ? (
                <div className="space-y-1.5">
                  {m.general && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-300">
                      <Sparkles className="w-3 h-3" /> From the AI model's general knowledge, not your document
                    </div>
                  )}
                  <div className="text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5">{m.a}</div>
                </div>
              ) : m.notFound ? (
                <div className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-3 space-y-2.5">
                  <p className="text-sm text-zinc-200">I couldn't find this in your document.</p>
                  <p className="text-xs text-zinc-500">Want an answer anyway?</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => answerFromAI(i, m.query)} disabled={busy}
                      className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg px-3 py-1.5 transition-colors">
                      <Sparkles className="w-3.5 h-3.5" /> Answer from the AI's knowledge
                    </button>
                    <button onClick={() => searchWeb(m.query)}
                      className="flex items-center gap-1.5 text-xs border border-zinc-600 hover:border-emerald-500 hover:text-emerald-300 text-zinc-300 rounded-lg px-3 py-1.5 transition-colors">
                      <Globe className="w-3.5 h-3.5" /> Search the web ↗
                    </button>
                  </div>
                </div>
              ) : (
                <Progress status={isLast && busy ? (status ?? { label: "Thinking...", pct: null, phase: null }) : { label: "Thinking...", pct: null, phase: null }} />
              )}
              {m.sources?.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap gap-2">
                    {m.sources.map((s, k) => {
                      const hasTime = s.timestamp != null
                      const key = `${i}-${k}`
                      const isOpen = openSrc === key
                      return (
                        <button key={k}
                          onClick={() => hasTime ? onSeek?.(s.timestamp) : setOpenSrc(isOpen ? null : key)}
                          title={hasTime ? "Jump to this moment in the video" : "Show this passage"}
                          className={`flex items-center gap-2 border rounded-lg pr-2.5 transition-colors cursor-pointer ${isOpen ? 'bg-zinc-700 border-emerald-600' : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700'}`}>
                          {s.frame
                            ? <img src={s.frame} alt={s.label} className="w-12 h-8 object-cover rounded-l-lg" />
                            : <span className="w-12 h-8 flex items-center justify-center text-[10px] text-zinc-400 px-1">{s.label}</span>}
                          <span className="text-[11px] text-zinc-300 flex items-center gap-1">
                            <CornerDownRight className="w-3 h-3" />{hasTime ? fmt(s.timestamp) : (isOpen ? 'hide' : 'view')}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {/* Expanded passage for a clicked document source */}
                  {m.sources.map((s, k) => {
                    const key = `${i}-${k}`
                    if (openSrc !== key || !s.text) return null
                    return (
                      <div key={`t-${k}`} className="text-xs text-zinc-300 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 whitespace-pre-wrap leading-relaxed">
                        <span className="text-emerald-400 font-semibold">{s.label}: </span>{s.text}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="p-3 border-t border-zinc-800 flex gap-2 bg-zinc-900">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Ask about this recording..."
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500" />
        <button onClick={submit} disabled={busy || !input.trim()}
          className="px-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg transition-colors">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
