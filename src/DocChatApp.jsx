import { useEffect, useRef, useState } from "react"
import { FileText, Upload, Globe, Cpu, ChevronDown } from "lucide-react"
import DocChat from "./components/DocChat"
import { extractText, chunkText } from "./hooks/useDocParser"
import { WEBLLM_MODELS, DEFAULT_WEBLLM_MODEL } from "./lib/llm"
import useVantaHalo from "./hooks/useVantaHalo"

export default function DocChatApp() {
  const vantaRef = useVantaHalo()
  const fileRef = useRef()
  const [passages, setPassages] = useState([])
  const [fileName, setFileName] = useState("")
  const [started, setStarted] = useState(false)
  const [chunking, setChunking] = useState(false)
  const [error, setError] = useState(null)

  // Model choice — the user picks, we never auto-switch.
  const [aiMode, setAiMode] = useState("webllm")
  const [webModel, setWebModel] = useState(DEFAULT_WEBLLM_MODEL)
  const [ollamaStatus, setOllamaStatus] = useState("checking")
  const [ollamaModels, setOllamaModels] = useState([])
  const [ollamaModel, setOllamaModel] = useState("")

  const checkOllama = (silent = false) => {
    if (!silent) setOllamaStatus("checking")
    fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(3000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.models?.length) {
          const names = data.models.map((m) => m.name)
          setOllamaModels(names)
          setOllamaModel((cur) => cur || names[0])
          setOllamaStatus("ok")
        } else setOllamaStatus("down")
      })
      .catch(() => setOllamaStatus("down"))
  }
  useEffect(() => { checkOllama() }, [])
  useEffect(() => {
    if (aiMode !== "ollama" || ollamaStatus !== "down") return
    const id = setInterval(() => checkOllama(true), 4000)
    return () => clearInterval(id)
  }, [aiMode, ollamaStatus])

  // Upload → show the chat + model picker immediately; do the chunking/indexing
  // in the background so the user can start as soon as it's ready.
  const load = (file) => {
    if (!file) return
    setError(null); setStarted(true); setChunking(true); setPassages([]); setFileName(file.name)
    ;(async () => {
      try {
        const text = await extractText(file)
        const chunks = chunkText(text)
        if (!chunks.length) throw new Error("Could not read any text from that file.")
        setPassages(chunks.map((c, i) => ({ label: `Part ${i + 1}`, text: c, timestamp: null, frame: null, annotation: null })))
      } catch (e) {
        setError(e.message)
      } finally {
        setChunking(false)
      }
    })()
  }

  const reset = () => {
    setStarted(false); setPassages([]); setFileName(""); setError(null); setChunking(false)
  }

  const chosenModel = aiMode === "ollama" ? ollamaModel : webModel
  const wm = WEBLLM_MODELS.find((m) => m.id === webModel) ?? WEBLLM_MODELS[0]
  const totalChars = passages.reduce((n, p) => n + (p.text?.length || 0), 0)
  const approxTokens = Math.round(totalChars / 4)

  return (
    <div className="min-h-screen text-white font-mono" style={{ position: "relative", background: "#0d0d2b" }}>
      <div ref={vantaRef} style={{ position: "fixed", inset: 0, zIndex: 0 }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, background: "rgba(8,5,20,0.72)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        <header className="border-b border-white/10 px-6 py-4 flex items-center gap-3 backdrop-blur-md bg-black/20 sticky top-0 z-40">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <button onClick={() => { window.location.href = "/#/" }}
            className="text-lg font-semibold tracking-tight hover:text-emerald-400 transition-colors">
            VideoDoc
          </button>
          <span className="text-zinc-600">/</span>
          <span className="text-sm text-emerald-300 font-semibold">Doc Chat</span>
          <a href="/#/app" className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Video → Docs →</a>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
          {!started ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Chat with a document</h2>
                <p className="text-zinc-500 text-sm">Upload a doc, pick a model, then ask it anything. Chunking and indexing run in your browser.</p>
              </div>
              <button onClick={() => fileRef.current.click()}
                className="border border-zinc-700 hover:border-emerald-500 rounded-2xl p-12 flex flex-col items-center gap-3 transition-all group cursor-pointer bg-zinc-900/70 w-full max-w-md">
                <Upload className="w-9 h-9 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
                <span className="text-sm text-zinc-300">Upload a document</span>
                <span className="text-xs text-zinc-600">.txt · .md · .html · .docx</span>
              </button>
              {error && <p className="text-sm text-red-400 max-w-md text-center">{error}</p>}
              <p className="text-xs text-zinc-600 max-w-md text-center">Everything runs in your browser. Nothing is uploaded. Big docs are chunked automatically.</p>
            </div>
          ) : (
            <>
              {/* File header */}
              <div className="flex items-center gap-3 border border-zinc-800 rounded-xl px-4 py-3 bg-zinc-900">
                <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{fileName}</div>
                  <div className="text-xs text-zinc-500">
                    {chunking
                      ? "Chunking the document…"
                      : `${passages.length} sections · ≈ ${approxTokens.toLocaleString()} tokens`}
                  </div>
                </div>
                <button onClick={reset} className="ml-auto text-xs text-zinc-500 hover:text-zinc-300">Change file</button>
              </div>

              {/* Model picker — user chooses, we never auto-switch */}
              <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-900 space-y-3">
                <p className="text-xs text-zinc-500 uppercase tracking-widest">Answer model</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setAiMode("webllm")}
                    className={`p-3 rounded-xl border-2 flex flex-col gap-1.5 text-left transition-all ${aiMode === "webllm" ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-700 hover:border-zinc-500"}`}>
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-medium">In-browser</span>
                    <span className="text-xs text-zinc-500">No install · runs on WebGPU</span>
                  </button>
                  <button onClick={() => setAiMode("ollama")}
                    className={`p-3 rounded-xl border-2 flex flex-col gap-1.5 text-left transition-all ${aiMode === "ollama" ? "border-blue-500 bg-blue-500/10" : "border-zinc-700 hover:border-zinc-500"}`}>
                    <Cpu className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium">Ollama</span>
                    <span className={`text-xs ${ollamaStatus === "ok" ? "text-emerald-400" : ollamaStatus === "down" ? "text-red-400" : "text-zinc-500"}`}>
                      {ollamaStatus === "checking" && "Checking…"}
                      {ollamaStatus === "ok" && `✓ ${ollamaModels.length} model${ollamaModels.length !== 1 ? "s" : ""}`}
                      {ollamaStatus === "down" && "Not detected"}
                    </span>
                  </button>
                </div>

                {/* WebLLM model options with accuracy + ETA */}
                {aiMode === "webllm" && (
                  <div>
                    <div className="relative">
                      <select value={webModel} onChange={(e) => setWebModel(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 appearance-none focus:outline-none focus:border-emerald-500 cursor-pointer">
                        {WEBLLM_MODELS.map((o) => (
                          <option key={o.id} value={o.id}>{o.label} · {o.params} · {o.size}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2.5">
                      {[["Accuracy", wm.accuracy], ["Speed", wm.speed], ["Answer ETA", wm.time]].map(([k, v]) => (
                        <div key={k} className="bg-zinc-800 border border-zinc-700/60 rounded-lg px-2.5 py-2">
                          <div className="text-[10px] uppercase tracking-wider text-zinc-500">{k}</div>
                          <div className="text-xs font-medium text-emerald-300 mt-0.5">{v}</div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-zinc-600 mt-2 leading-relaxed">{wm.note}</p>
                    <p className="text-xs text-zinc-600 mt-1.5">ETA is per answer plus a one-time model download. Faster on a dedicated GPU, slower on Intel / integrated graphics.</p>
                  </div>
                )}

                {/* Ollama model dropdown / hint */}
                {aiMode === "ollama" && ollamaStatus === "ok" && (
                  <div className="relative">
                    <select value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 appearance-none focus:outline-none focus:border-blue-500 cursor-pointer">
                      {ollamaModels.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                  </div>
                )}
                {aiMode === "ollama" && ollamaStatus === "down" && (
                  <div className="bg-zinc-800 rounded-lg p-3 text-xs text-zinc-400">
                    Ollama not detected. Run it locally, allow this origin with <code className="text-emerald-300">setx OLLAMA_ORIGINS "*"</code>, restart Ollama, and it connects on its own. Fastest and most accurate option for tech users.
                    <button onClick={() => checkOllama()} className="mt-2 w-full py-1.5 border border-blue-500/50 hover:bg-blue-500/10 text-blue-300 rounded-lg transition-all">↻ Retry detection</button>
                  </div>
                )}
              </div>

              {/* Chat — usable as soon as chunks are ready */}
              {passages.length > 0 ? (
                <DocChat docs={passages} aiMode={aiMode} ollamaModel={chosenModel} autoStart />
              ) : (
                <div className="border border-zinc-800 rounded-xl px-4 py-6 bg-zinc-900 text-sm text-zinc-400 flex items-center gap-3">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                  {error ? <span className="text-red-400">{error}</span> : "Preparing the document… you can pick your model while this finishes."}
                </div>
              )}
            </>
          )}

          <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json,.html,.htm,.docx" className="hidden"
            onChange={(e) => e.target.files[0] && load(e.target.files[0])} />
        </main>
      </div>
    </div>
  )
}
