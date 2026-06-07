import { useState, useEffect } from "react"
import { X, Globe, Cpu, Plus, FileText, ChevronDown } from "lucide-react"
import { DEFAULT_SECTIONS } from "../hooks/useDocParser"

export default function AISettings({ onConfirm, onClose, suggestedSections, toolsUsed = [] }) {
  const [mode, setMode] = useState("webllm") // browser-first: works for everyone, no install
  const [ollamaStatus, setOllamaStatus] = useState("checking")
  const [ollamaModels, setOllamaModels] = useState([])
  const [selectedModel, setSelectedModel] = useState("")
  const [selected, setSelected] = useState([])
  const [customSections, setCustomSections] = useState([])
  const [customInput, setCustomInput] = useState("")
  const [title, setTitle] = useState("")

  useEffect(() => {
    setSelected(suggestedSections?.length ? suggestedSections : [])
  }, [suggestedSections])

  const checkOllama = (silent = false) => {
    if (!silent) setOllamaStatus("checking")
    fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(3000) })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.models?.length) {
          const names = data.models.map(m => m.name)
          setOllamaModels(names)
          setSelectedModel(names[0])
          setOllamaStatus("ok")
        } else {
          setOllamaStatus("down")
        }
      })
      .catch(() => setOllamaStatus("down"))
  }

  useEffect(() => { checkOllama() }, [])

  // Keep checking quietly while the user has Ollama selected but it's not
  // detected yet — so the moment they allow this origin (OLLAMA_ORIGINS) and
  // restart Ollama, it connects on its own without needing a Retry click.
  useEffect(() => {
    if (mode !== "ollama" || ollamaStatus !== "down") return
    const id = setInterval(() => checkOllama(true), 4000)
    return () => clearInterval(id)
  }, [mode, ollamaStatus])

  const toggle = (s) =>
    setSelected(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  const addCustom = () => {
    const v = customInput.trim()
    if (v && !selected.includes(v)) {
      setCustomSections(prev => [...prev, v])
      setSelected(prev => [...prev, v])
    }
    setCustomInput("")
  }

  const allSuggestions = [...new Set([...(suggestedSections ?? []), ...DEFAULT_SECTIONS, ...customSections])]

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-lg space-y-5 max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">Configure Annotation</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Document title */}
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Document Title</p>
          <input
            type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. How to set up the R3 → S4 mapping macro"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
          />
          <p className="text-xs text-zinc-600 mt-1.5">Used as the guide heading. Leave blank for an auto title (not the video file name).</p>
          {toolsUsed.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              <span className="text-xs text-zinc-500">Detected tools:</span>
              {toolsUsed.map(t => (
                <span key={t} className="text-xs bg-blue-500/15 text-blue-300 px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-zinc-800" />

        {/* AI Backend */}
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">AI Backend</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setMode("webllm")}
              className={`p-4 rounded-xl border-2 flex flex-col gap-2 text-left transition-all
                ${mode === "webllm" ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-700 hover:border-zinc-500"}`}>
              <Globe className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-medium">WebLLM</span>
              <span className="text-xs text-zinc-500 leading-relaxed">Runs in browser. First run ~1GB.</span>
              <span className="text-xs text-zinc-400">Chrome 113+ · 8 GB+ RAM</span>
            </button>

            <button onClick={() => setMode("ollama")}
              className={`p-4 rounded-xl border-2 flex flex-col gap-2 text-left transition-all
                ${mode === "ollama" ? "border-blue-500 bg-blue-500/10" : "border-zinc-700 hover:border-zinc-500"}`}>
              <Cpu className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-medium">Ollama</span>
              <span className="text-xs text-zinc-500 leading-relaxed">Uses your local Ollama models.</span>
              <span className={`text-xs mt-auto ${
                ollamaStatus === "ok" ? "text-emerald-400" :
                ollamaStatus === "down" ? "text-red-400" : "text-zinc-500"}`}>
                {ollamaStatus === "checking" && "Checking..."}
                {ollamaStatus === "ok" && `✓ Running · ${ollamaModels.length} model${ollamaModels.length !== 1 ? 's' : ''}`}
                {ollamaStatus === "down" && "Not detected"}
              </span>
            </button>
          </div>

          {/* Model selector — shown when Ollama is running */}
          {mode === "ollama" && ollamaStatus === "ok" && ollamaModels.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-zinc-500 mb-1.5">Select model</p>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 appearance-none focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {ollamaModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              </div>
            </div>
          )}

          {mode === "ollama" && ollamaStatus === "down" && (
            <div className="bg-zinc-800 rounded-lg p-3.5 text-xs text-zinc-400 mt-3">
              {/* Already installed → unblock with CORS */}
              <p className="text-zinc-200 font-semibold text-sm mb-2">Already have Ollama? Connect it in 4 steps:</p>
              <ol className="space-y-2.5">
                <li>
                  <span className="text-zinc-300 font-medium">1. Open PowerShell.</span>
                  <span className="block text-zinc-500 mt-0.5">Press the Windows key, type <span className="text-zinc-300">PowerShell</span>, hit Enter.</span>
                </li>
                <li>
                  <span className="text-zinc-300 font-medium">2. Allow this site to reach Ollama.</span>
                  <span className="block text-zinc-500 mt-0.5">Paste this and press Enter:</span>
                  <code className="block text-emerald-300 font-mono bg-black/40 rounded px-2 py-1.5 mt-1 whitespace-pre-wrap break-all">setx OLLAMA_ORIGINS "*"</code>
                </li>
                <li>
                  <span className="text-zinc-300 font-medium">3. Fully restart Ollama.</span>
                  <span className="block text-zinc-500 mt-0.5">Find the Ollama icon in your system tray (bottom-right of the taskbar), right-click it → <span className="text-zinc-300">Quit</span>. Then open Ollama again from the Start menu. <span className="text-amber-400">This step is required</span> — the setting only applies after a restart.</span>
                </li>
                <li>
                  <span className="text-zinc-300 font-medium">4. Load a model (if you haven't).</span>
                  <span className="block text-zinc-500 mt-0.5">Back in PowerShell, run:</span>
                  <code className="block text-emerald-300 font-mono bg-black/40 rounded px-2 py-1.5 mt-1 whitespace-pre-wrap break-all">ollama run gemma3</code>
                </li>
              </ol>

              <p className="text-zinc-500 mt-3">That's it — this page reconnects on its own within a few seconds. No need to refresh.</p>

              <div className="border-t border-zinc-700 my-3" />

              <p className="text-zinc-400">New to Ollama? Download it free from <a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">ollama.com</a>, install, then follow step 4 above.</p>

              <button
                onClick={() => checkOllama()}
                className="mt-3 w-full py-2 border border-blue-500/50 hover:border-blue-400 hover:bg-blue-500/10 text-blue-300 rounded-lg transition-all font-medium">
                ↻ Retry detection now
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-800" />

        {/* Documentation Sections */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-zinc-500" />
            <p className="text-xs text-zinc-500 uppercase tracking-widest">Documentation Sections</p>
            {suggestedSections?.length > 0 && (
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full ml-auto">
                from your reference doc
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-600 mb-3">
            Select sections for structured output — or leave empty for auto step-by-step format.
          </p>

          <div className="flex flex-wrap gap-2">
            {allSuggestions.map(s => (
              <button key={s} onClick={() => toggle(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  selected.includes(s)
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                    : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
                }`}>
                {selected.includes(s) ? '✓ ' : ''}{s}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mt-3">
            <input type="text" value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
              placeholder="Add custom section..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
            <button onClick={addCustom} disabled={!customInput.trim()}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 border border-zinc-700 rounded-lg text-zinc-400 transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {selected.length === 0 && (
            <p className="text-xs text-zinc-600 mt-2">No sections selected — will generate numbered steps automatically.</p>
          )}
        </div>

        <button
          onClick={() => onConfirm(mode, selected.length > 0 ? selected : null, selectedModel, title.trim())}
          disabled={mode === "ollama" && ollamaStatus === "down"}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors">
          Start Annotation
        </button>
      </div>
    </div>
  )
}
