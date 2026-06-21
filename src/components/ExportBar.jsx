import { useState } from "react"
import { exportHTML } from "../lib/exportHTML"
import { exportPDF } from "../lib/exportPDF"
import { exportDOCX } from "../lib/exportDOCX"
import { renderMermaidSVG, svgToPngDataURL } from "../lib/mermaidRender"
import useClipMaker from "../hooks/useClipMaker"
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

export default function ExportBar({ annotatedDocs, transcriptChunks, videoName, videoFile, docTitle, companyName, insights, toolsUsed, frames }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [gifMsg, setGifMsg] = useState(null)
  const { makeClips } = useClipMaker()

  const hasContent = (annotatedDocs?.length ?? 0) + (transcriptChunks?.length ?? 0) > 0
  // Title for the guide: user-provided title preferred; never the raw video file name.
  const title = (docTitle && docTitle.trim()) || "Step-by-Step Guide"
  const name = videoName || "video"

  const handle = async (type) => {
    if (!hasContent || busy) return
    setBusy(type)
    setError(null)
    try {
      const docs = toExportDocs(annotatedDocs, transcriptChunks)

      // Flow diagram: render the Mermaid once. HTML embeds the live SVG; PDF/DOCX
      // embed a rasterised PNG. Both are fully offline (no runtime, no CDN).
      let mermaidSvg = "", flowImage = null
      if (insights?.mermaid) {
        setGifMsg("Rendering flow diagram…")
        mermaidSvg = await renderMermaidSVG(insights.mermaid)
        if (type !== "html" && mermaidSvg) flowImage = await svgToPngDataURL(mermaidSvg)
        setGifMsg(null)
      }
      const meta = { title, company: companyName || "", insights: insights || null, tools: toolsUsed || [], flowImage, transcript: transcriptChunks || [] }

      if (type === "html") {
        // Build a short, sharp WebM clip per step — browser-only, base64-inlined.
        let clips = new Map()
        if (videoFile && docs.length) {
          clips = await makeClips(videoFile, docs, (i, t) => setGifMsg(`Building step clips ${i}/${t}… (keep this tab focused)`))
          setGifMsg(null)
        }
        await exportHTML(docs, name, frames, { ...meta, clips, mermaidSvg })
      }
      if (type === "pdf") await exportPDF(docs, name, meta)
      if (type === "docx") await exportDOCX(docs, name, meta)
    } catch (e) {
      setError(`${type.toUpperCase()} export failed: ${e.message}`)
    } finally {
      setBusy(null)
      setGifMsg(null)
    }
  }

  return (
    <div className="border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
      <Download className="w-4 h-4 text-zinc-500 shrink-0" />
      {!hasContent && (
        <span className="text-xs text-zinc-600">Process a video to enable export</span>
      )}
      {gifMsg && <span className="text-xs text-emerald-400 mr-auto">{gifMsg}</span>}
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
