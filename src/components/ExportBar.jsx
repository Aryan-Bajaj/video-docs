import { useState } from "react"
import { exportHTML } from "../lib/exportHTML"
import { exportPDF } from "../lib/exportPDF"
import { exportDOCX } from "../lib/exportDOCX"
import { Download } from "lucide-react"

function toExportDocs(annotatedDocs, transcriptChunks) {
  if (annotatedDocs?.length > 0) return annotatedDocs
  return (transcriptChunks ?? []).map(c => {
    const ts = c.timestamp?.[0] ?? 0
    const m = Math.floor(ts / 60).toString().padStart(2, "0")
    const s = Math.floor(ts % 60).toString().padStart(2, "0")
    return { timestamp: ts, label: `${m}:${s}`, text: c.text, frame: null, annotation: null }
  })
}

export default function ExportBar({ annotatedDocs, transcriptChunks, videoName, frames }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const hasContent = (annotatedDocs?.length ?? 0) + (transcriptChunks?.length ?? 0) > 0
  const name = videoName || "video"

  const handle = async (type) => {
    if (!hasContent || busy) return
    setBusy(type)
    setError(null)
    try {
      const docs = toExportDocs(annotatedDocs, transcriptChunks)
      if (type === "html") exportHTML(docs, name, frames)
      if (type === "pdf") await exportPDF(docs, name)
      if (type === "docx") await exportDOCX(docs, name)
    } catch (e) {
      setError(`${type.toUpperCase()} export failed: ${e.message}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
      <Download className="w-4 h-4 text-zinc-500 shrink-0" />
      {!hasContent && (
        <span className="text-xs text-zinc-600">Process a video to enable export</span>
      )}
      {error && <span className="text-xs text-red-400 mr-auto">{error}</span>}
      <div className="ml-auto flex gap-2">
        {["html", "pdf", "docx"].map(type => (
          <button
            key={type}
            onClick={() => handle(type)}
            disabled={!hasContent || !!busy}
            className={`px-4 py-2 text-xs font-semibold uppercase rounded-lg transition-all
              ${hasContent && !busy
                ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
                : "bg-zinc-900 text-zinc-600 cursor-not-allowed"
              }`}
          >
            {busy === type ? "..." : type}
          </button>
        ))}
      </div>
    </div>
  )
}
