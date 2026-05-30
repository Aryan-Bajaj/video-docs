import { useRef } from "react"
import { Video, FileCode, FileText } from "lucide-react"

export default function Uploader({ onVideoSelect, onCodeSelect, onDocSelect, docParsing, docSections }) {
  const videoRef = useRef()
  const codeRef = useRef()
  const docRef = useRef()

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Drop your video</h2>
        <p className="text-zinc-500 text-sm">Auto-transcribe → annotate → export docs</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
        {/* Video */}
        <button
          onClick={() => videoRef.current.click()}
          className="border border-zinc-700 hover:border-emerald-500 rounded-xl p-8 flex flex-col items-center gap-3 transition-all group cursor-pointer bg-zinc-900"
        >
          <Video className="w-8 h-8 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
          <span className="text-sm text-zinc-400">Upload Video</span>
          <span className="text-xs text-zinc-600">.mp4 .mov .webm</span>
        </button>

        {/* Code files */}
        <button
          onClick={() => codeRef.current.click()}
          className="border border-zinc-700 hover:border-blue-500 rounded-xl p-8 flex flex-col items-center gap-3 transition-all group cursor-pointer bg-zinc-900"
        >
          <FileCode className="w-8 h-8 text-zinc-500 group-hover:text-blue-400 transition-colors" />
          <span className="text-sm text-zinc-400">Code Files</span>
          <span className="text-xs text-zinc-600">optional</span>
        </button>

        {/* Reference doc */}
        <button
          onClick={() => docRef.current.click()}
          className={`border rounded-xl p-8 flex flex-col items-center gap-3 transition-all group cursor-pointer bg-zinc-900
            ${docSections?.length > 0
              ? 'border-amber-500/60 bg-amber-500/5'
              : 'border-zinc-700 hover:border-amber-500'}`}
        >
          <FileText className={`w-8 h-8 transition-colors ${
            docSections?.length > 0 ? 'text-amber-400' : 'text-zinc-500 group-hover:text-amber-400'
          }`} />
          <span className="text-sm text-zinc-400">
            {docParsing ? 'Parsing...' : docSections?.length > 0 ? 'Doc Loaded ✓' : 'Reference Doc'}
          </span>
          <span className="text-xs text-zinc-600">
            {docSections?.length > 0
              ? `${docSections.length} sections found`
              : '.html or .docx — optional'}
          </span>
        </button>
      </div>

      {docSections?.length > 0 && (
        <div className="flex flex-wrap gap-2 max-w-2xl justify-center">
          {docSections.map(s => (
            <span key={s} className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full">
              {s}
            </span>
          ))}
        </div>
      )}

      <input ref={videoRef} type="file" accept="video/*" className="hidden"
        onChange={e => e.target.files[0] && onVideoSelect(e.target.files[0])} />
      <input ref={codeRef} type="file" multiple className="hidden"
        onChange={e => onCodeSelect(Array.from(e.target.files))} />
      <input ref={docRef} type="file" accept=".html,.htm,.docx" className="hidden"
        onChange={e => e.target.files[0] && onDocSelect(e.target.files[0])} />
    </div>
  )
}
