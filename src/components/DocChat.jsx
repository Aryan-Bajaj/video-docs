import { useState, useCallback } from "react"
import useRAG from "../hooks/useRAG"
import { MessageSquare, Send, CornerDownRight } from "lucide-react"

function fmt(ts) {
  if (ts == null) return ""
  const m = Math.floor(ts / 60).toString().padStart(2, "0")
  const s = Math.floor(ts % 60).toString().padStart(2, "0")
  return `${m}:${s}`
}

export default function DocChat({ docs, aiMode, ollamaModel, onSeek }) {
  const { buildIndex, ask, isReady } = useRAG()
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState(null)
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState([]) // {q, a, sources}

  const ensureIndex = useCallback(async () => {
    if (ready || isReady()) { setReady(true); return }
    setStatus("Indexing documentation...")
    await buildIndex(docs, (s) => setStatus(s))
    setStatus(null)
    setReady(true)
  }, [ready, isReady, buildIndex, docs])

  const handleOpen = async () => {
    setOpen(true)
    try { await ensureIndex() } catch (e) { setStatus(e.message) }
  }

  const submit = async () => {
    const q = input.trim()
    if (!q || busy) return
    setInput("")
    setBusy(true)
    setMessages((m) => [...m, { q, a: null, sources: [] }])
    try {
      await ensureIndex()
      const { answer, sources } = await ask(q, aiMode || "webllm", ollamaModel, (s) => setStatus(s))
      setMessages((m) => m.map((x, i) => i === m.length - 1 ? { ...x, a: answer, sources } : x))
    } catch (e) {
      setMessages((m) => m.map((x, i) => i === m.length - 1 ? { ...x, a: `⚠️ ${e.message}` } : x))
    } finally {
      setBusy(false); setStatus(null)
    }
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
    <div className="border border-zinc-800 rounded-xl overflow-hidden flex flex-col" style={{ maxHeight: 520 }}>
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2 bg-black/20">
        <MessageSquare className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-semibold">Vid Chat</span>
        {status && <span className="text-xs text-emerald-400 ml-auto truncate max-w-[50%]">{status}</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-xs text-zinc-500">e.g. “How do I run the macro?” · “Which tools are used?” · “What happens after clicking Annotate?”</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className="space-y-2">
            <div className="text-sm text-zinc-200"><span className="text-emerald-400 font-semibold">You: </span>{m.q}</div>
            {m.a == null ? (
              <div className="text-sm text-zinc-500 italic">…thinking</div>
            ) : (
              <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{m.a}</div>
            )}
            {m.sources?.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {m.sources.map((s, k) => (
                  <button key={k} onClick={() => onSeek?.(s.timestamp)}
                    title="Jump to this moment in the video"
                    className="flex items-center gap-2 bg-zinc-800/70 hover:bg-zinc-700 border border-zinc-700 rounded-lg pr-2.5 transition-colors">
                    {s.frame
                      ? <img src={s.frame} alt={s.label} className="w-12 h-8 object-cover rounded-l-lg" />
                      : <span className="w-12 h-8 flex items-center justify-center text-[10px] text-zinc-500">{s.label}</span>}
                    <span className="text-[11px] text-zinc-400 flex items-center gap-1"><CornerDownRight className="w-3 h-3" />{fmt(s.timestamp)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-zinc-800 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Ask about this recording..."
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500" />
        <button onClick={submit} disabled={busy || !input.trim()}
          className="px-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg transition-colors">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
