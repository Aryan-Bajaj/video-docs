import { useState, useEffect } from "react"
import { X, Globe, Cpu, Plus, FileText, ChevronDown, Eye, Gauge, AlertTriangle } from "lucide-react"
import { DEFAULT_SECTIONS } from "../hooks/useDocParser"
import { WEBLLM_MODELS, DEFAULT_WEBLLM_MODEL, isWebLLMVision, ollamaModelHasVision, recommendModel, modelGB, localEngineStatus } from "../lib/llm"
import { probeSystem } from "../lib/systemCheck"

// Desktop build ships ONE engine (bundled llama.cpp + gemma3 vision) so a
// non-technical user on an office laptop never has to choose or install
// anything. WebLLM/Ollama choices exist only in the web build.
const DESKTOP = import.meta.env.VITE_BUILD_TARGET === "desktop"

export default function AISettings({ onConfirm, onClose, suggestedSections, toolsUsed = [] }) {
  const [mode, setMode] = useState(DESKTOP ? "local" : "webllm") // browser-first on web: works for everyone, no install
  const [ollamaStatus, setOllamaStatus] = useState("checking")
  const [ollamaModels, setOllamaModels] = useState([])
  const [selectedModel, setSelectedModel] = useState("")
  const [webModel, setWebModel] = useState(DEFAULT_WEBLLM_MODEL)
  const [selected, setSelected] = useState([])
  const [customSections, setCustomSections] = useState([])
  const [customInput, setCustomInput] = useState("")
  const [title, setTitle] = useState("")
  const [company, setCompany] = useState("")
  const [ollamaVision, setOllamaVision] = useState(false)
  // Accuracy passes — both default ON. Self-verify fact-checks each step against
  // the evidence (~2x slower); Consolidation tidies titles into a coherent SOP.
  const [selfVerify, setSelfVerify] = useState(true)
  const [consolidate, setConsolidate] = useState(true)
  // System probe → model recommendation (browser-side; works on any OS/device).
  const [sys, setSys] = useState(null)
  const [testing, setTesting] = useState(false)
  // Bundled desktop engine (llama.cpp + gemma3) — only present in the desktop app.
  const [hasLocalEngine, setHasLocalEngine] = useState(false)

  // In the packaged desktop app the bundled engine is running on localhost; detect
  // it and make it the default (best accuracy, zero setup, fully offline). In the
  // desktop build keep polling until it's up — the engine can still be loading
  // the model when the user reaches this dialog.
  useEffect(() => {
    let alive = true
    const check = () => localEngineStatus().then((ok) => { if (alive && ok) { setHasLocalEngine(true); if (DESKTOP) setMode("local") } })
    check()
    if (!DESKTOP) return () => { alive = false }
    const id = setInterval(() => { if (!hasLocalEngine) check() }, 3000)
    return () => { alive = false; clearInterval(id) }
  }, [hasLocalEngine])

  const runSystemTest = async () => {
    setTesting(true)
    try {
      const result = await probeSystem()
      setSys(result)
      // Auto-pick the best model the device can handle (keep vision only if it fits).
      if (result.webgpu && result.capacityGB > 0) {
        setWebModel(recommendModel(result.capacityGB, isWebLLMVision(webModel)))
      }
    } catch {
      setSys({ webgpu: false, os: "your device", error: true })
    }
    setTesting(false)
  }

  // Warn (simple English) if the chosen model is heavier than the device can load.
  const heavyWarning = (() => {
    if (!sys || !sys.webgpu) return null
    const need = modelGB(webModel)
    if (need <= sys.capacityGB + 0.2) return null
    const lighter = recommendModel(sys.capacityGB, false)
    const lighterLabel = WEBLLM_MODELS.find((m) => m.id === lighter)?.label || "a lighter model"
    return `This model needs about ${need} GB of graphics memory. ${sys.os} looks like it can handle around ${sys.capacityGB} GB, so it may load very slowly or fail. Pick "${lighterLabel}" for a smooth run.`
  })()

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

  useEffect(() => { if (!DESKTOP) checkOllama() }, [])

  // Keep checking quietly while the user has Ollama selected but it's not
  // detected yet — so the moment they allow this origin (OLLAMA_ORIGINS) and
  // restart Ollama, it connects on its own without needing a Retry click.
  useEffect(() => {
    if (mode !== "ollama" || ollamaStatus !== "down") return
    const id = setInterval(() => checkOllama(true), 4000)
    return () => clearInterval(id)
  }, [mode, ollamaStatus])

  // Does the selected Ollama model support vision (e.g. gemma3)? → show a badge.
  useEffect(() => {
    if (mode !== "ollama" || !selectedModel) { setOllamaVision(false); return }
    let alive = true
    ollamaModelHasVision(selectedModel).then((v) => { if (alive) setOllamaVision(v) })
    return () => { alive = false }
  }, [mode, selectedModel])

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

          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2 mt-4">Company name <span className="text-zinc-600 normal-case tracking-normal">(optional)</span></p>
          <input
            type="text" value={company} onChange={e => setCompany(e.target.value)}
            placeholder="e.g. company name"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
          />
          <p className="text-xs text-zinc-600 mt-1.5">Shown in the top-right of the exported document.</p>

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

          {/* Bundled desktop engine — the ONLY engine in the desktop build */}
          {(hasLocalEngine || DESKTOP) && (
            <button onClick={() => setMode("local")}
              className={`w-full mb-3 p-4 rounded-xl border-2 flex items-start gap-3 text-left transition-all
                ${mode === "local" ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-700 hover:border-zinc-500"}`}>
              <Eye className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
              <span>
                <span className="block text-sm font-medium">Built-in AI (gemma3){DESKTOP ? "" : " · Recommended"}</span>
                <span className="block text-xs text-zinc-400 mt-0.5">Runs inside this app — best accuracy, sees the screen, fully offline. Nothing leaves your device.</span>
                {hasLocalEngine
                  ? <span className="block text-xs text-emerald-400 mt-1">✓ Ready</span>
                  : <span className="block text-xs text-amber-400 mt-1">Starting… if this doesn't turn green, launch VideoDoc.bat and keep its window open.</span>}
              </span>
            </button>
          )}

          {!DESKTOP && (
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
          )}

          {/* WebLLM model picker — speed vs accuracy, all in-browser */}
          {!DESKTOP && mode === "webllm" && (() => {
            const m = WEBLLM_MODELS.find(x => x.id === webModel) ?? WEBLLM_MODELS[0]
            return (
              <div className="mt-3">
                {/* System test → model recommendation */}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <button onClick={runSystemTest} disabled={testing}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-600/50 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors">
                    <Gauge className="w-3.5 h-3.5" /> {testing ? "Testing…" : "Test my system"}
                  </button>
                  {sys && (
                    <span className="text-xs text-zinc-400">
                      {sys.webgpu
                        ? `${sys.os} · ${sys.gpuName || (sys.discrete ? "dedicated GPU" : "integrated graphics")}${sys.ram ? ` · ${sys.ram} GB RAM` : ""} → fits ~${sys.capacityGB} GB`
                        : `${sys.os}: in-browser AI not supported here (no WebGPU — use Chrome/Edge on desktop)`}
                    </span>
                  )}
                </div>

                <p className="text-xs text-zinc-500 mb-1.5">Browser model{sys?.webgpu ? " · auto-picked for your system" : ""}</p>
                <div className="relative">
                  <select
                    value={webModel}
                    onChange={e => setWebModel(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 appearance-none focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {WEBLLM_MODELS.map(o => (
                      <option key={o.id} value={o.id}>{o.label} · {o.name || o.params} · {o.size}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2.5">
                  {[['Accuracy', m.accuracy], ['Speed', m.speed], ['Per segment', m.time]].map(([k, v]) => (
                    <div key={k} className="bg-zinc-800/60 border border-zinc-700/60 rounded-lg px-2.5 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{k}</div>
                      <div className="text-xs font-medium text-emerald-300 mt-0.5">{v}</div>
                    </div>
                  ))}
                </div>
                {isWebLLMVision(webModel) && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2.5 py-1.5">
                    <Eye className="w-3.5 h-3.5 shrink-0" /> Reads the actual screen (not just OCR) — most accurate steps.
                  </div>
                )}
                {heavyWarning && (
                  <div className="flex items-start gap-2 mt-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {heavyWarning}
                  </div>
                )}
                <p className="text-xs text-zinc-600 mt-2 leading-relaxed">{m.note}</p>
                <p className="text-xs text-zinc-600 mt-1.5">
                  Times are a rough per-segment estimate plus a one-time model download. Slower on Intel / integrated graphics, faster on a dedicated GPU.
                </p>
              </div>
            )
          })()}

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
              {ollamaVision && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2.5 py-1.5">
                  <Eye className="w-3.5 h-3.5 shrink-0" /> This model sees the screen — screenshots are sent for the most accurate steps.
                </div>
              )}
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

        {/* Output format: fixed professional Desktop Procedure */}
        <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-lg p-3.5">
          <div className="flex items-center gap-2 mb-1.5">
            <FileText className="w-4 h-4 text-emerald-400" />
            <p className="text-xs text-zinc-300 uppercase tracking-widest font-semibold">Output: Desktop Procedure</p>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Generates a structured procedure with an Index, Purpose, Prerequisites, numbered
            step-by-step actions (Action → Result + screenshot), Key Observations, Summary, FAQ and a Flow diagram.
            Off-topic / silent segments are skipped automatically.
          </p>
        </div>

        {/* Accuracy passes */}
        <div className="space-y-2.5">
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Accuracy</p>

          <button
            onClick={() => setSelfVerify(v => !v)}
            className="w-full flex items-start gap-3 text-left p-3 rounded-lg border border-zinc-700/60 bg-zinc-800/40 hover:border-zinc-600 transition-colors">
            <span className={`mt-0.5 w-9 h-5 rounded-full shrink-0 relative transition-colors ${selfVerify ? "bg-emerald-600" : "bg-zinc-600"}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${selfVerify ? "left-[18px]" : "left-0.5"}`} />
            </span>
            <span>
              <span className="block text-sm font-medium text-zinc-200">Self-verify each step</span>
              <span className="block text-xs text-zinc-500 leading-relaxed">The AI re-checks every step against the screen + transcript and drops anything it can't see. Much fewer made-up steps. ~2× slower.</span>
            </span>
          </button>

          <button
            onClick={() => setConsolidate(v => !v)}
            className="w-full flex items-start gap-3 text-left p-3 rounded-lg border border-zinc-700/60 bg-zinc-800/40 hover:border-zinc-600 transition-colors">
            <span className={`mt-0.5 w-9 h-5 rounded-full shrink-0 relative transition-colors ${consolidate ? "bg-emerald-600" : "bg-zinc-600"}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${consolidate ? "left-[18px]" : "left-0.5"}`} />
            </span>
            <span>
              <span className="block text-sm font-medium text-zinc-200">Consolidate procedure</span>
              <span className="block text-xs text-zinc-500 leading-relaxed">A final pass that tidies the step titles and merges duplicates into one clean, coherent procedure.</span>
            </span>
          </button>
        </div>

        <button
          onClick={() => onConfirm(mode, null, mode === "ollama" ? selectedModel : mode === "local" ? "gemma3" : webModel, title.trim(), company.trim(), { selfVerify, consolidate })}
          disabled={mode === "ollama" && ollamaStatus === "down"}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors">
          Generate Procedure
        </button>
      </div>
    </div>
  )
}
