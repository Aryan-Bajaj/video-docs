import { useRef, useState } from "react"
import { FileText, Upload } from "lucide-react"
import DocChat from "./components/DocChat"
import { extractText, chunkText } from "./hooks/useDocParser"
import useVantaHalo from "./hooks/useVantaHalo"

export default function DocChatApp() {
  const vantaRef = useVantaHalo()
  const fileRef = useRef()
  const [passages, setPassages] = useState([])
  const [fileName, setFileName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = async (file) => {
    if (!file) return
    setError(null); setLoading(true); setPassages([]); setFileName(file.name)
    try {
      const text = await extractText(file)
      const chunks = chunkText(text)
      if (!chunks.length) throw new Error("Could not read any text from that file.")
      setPassages(chunks.map((c, i) => ({ label: `Part ${i + 1}`, text: c, timestamp: null, frame: null, annotation: null })))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

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
          {passages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Chat with a document</h2>
                <p className="text-zinc-500 text-sm">Upload a doc, it gets chunked and indexed in your browser, then ask it anything.</p>
              </div>
              <button onClick={() => fileRef.current.click()}
                className="border border-zinc-700 hover:border-emerald-500 rounded-2xl p-12 flex flex-col items-center gap-3 transition-all group cursor-pointer bg-zinc-900/70 w-full max-w-md">
                {loading
                  ? <span className="text-sm text-emerald-400">Reading {fileName}…</span>
                  : <>
                      <Upload className="w-9 h-9 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
                      <span className="text-sm text-zinc-300">Upload a document</span>
                      <span className="text-xs text-zinc-600">.txt · .md · .html · .docx</span>
                    </>}
              </button>
              {error && <p className="text-sm text-red-400 max-w-md text-center">{error}</p>}
              <p className="text-xs text-zinc-600 max-w-md text-center">Everything runs in your browser. Nothing is uploaded. Big docs are chunked automatically.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border border-zinc-800 rounded-xl px-4 py-3 bg-zinc-900/60">
                <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{fileName}</div>
                  <div className="text-xs text-zinc-500">{passages.length} chunks indexed · ready to chat</div>
                </div>
                <button onClick={() => { setPassages([]); setFileName(""); setError(null) }}
                  className="ml-auto text-xs text-zinc-500 hover:text-zinc-300">Change file</button>
              </div>
              <DocChat docs={passages} aiMode="webllm" />
            </>
          )}

          <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json,.html,.htm,.docx" className="hidden"
            onChange={(e) => e.target.files[0] && load(e.target.files[0])} />
        </main>
      </div>
    </div>
  )
}
