import { useState, useRef, useEffect, useCallback } from "react"
import Uploader from "./components/Uploader"
import VideoPlayer from "./components/VideoPlayer"
import DocPreview from "./components/DocPreview"
import ExportBar from "./components/ExportBar"
import FrameStrip from "./components/FrameStrip"
import AISettings from "./components/AISettings"
import DocChat from "./components/DocChat"
import PipelineStatus from "./components/PipelineStatus"
import InsightsPanel from "./components/InsightsPanel"
import useFrameExtractor from "./hooks/useFrameExtractor"
import useAudioExtractor from "./hooks/useAudioExtractor"
import useTranscriber from "./hooks/useTranscriber"
import useAnnotator from "./hooks/useAnnotator"
import useDocParser from "./hooks/useDocParser"
import useOCR from "./hooks/useOCR"
import useVantaHalo from "./hooks/useVantaHalo"
import { webLLMLabel, isWebLLMVision, ollamaModelHasVision } from "./lib/llm"
import { generateInsights } from "./lib/insights"
import { consolidateProcedure, verifyProcedure } from "./lib/refine"
import { scrubSensitive } from "./lib/skillPrompt"
import { fixTranscriptChunks } from "./lib/transcriptFixups"

const INITIAL_STEPS = [
  { id: 'frames',     label: 'Extract Frames',   status: 'pending', detail: null },
  { id: 'audio',      label: 'Extract Audio',     status: 'pending', detail: null },
  { id: 'transcribe', label: 'Transcribe Audio',  status: 'pending', detail: null, pct: null },
  { id: 'ocr',        label: 'Read Screen (OCR)', status: 'pending', detail: null, pct: null, step: null, total: null },
  { id: 'loadmodel',  label: 'Load AI Model',     status: 'pending', detail: null, pct: null },
  { id: 'annotate',   label: 'Write Procedure Steps', status: 'pending', detail: null, pct: null, step: null, total: null, etaMs: null },
  { id: 'verify',     label: 'Self-Verify Steps', status: 'pending', detail: null, pct: null, step: null, total: null, etaMs: null },
  { id: 'consolidate',label: 'Consolidate Procedure', status: 'pending', detail: null },
  { id: 'insights',   label: 'Purpose · Summary · FAQ · Flow', status: 'pending', detail: null },
]

export default function App() {
  const [videoFile, setVideoFile] = useState(null)
  const [frames, setFrames] = useState([])
  const [activeFrame, setActiveFrame] = useState(null)
  const [seekTo, setSeekTo] = useState(null)
  const [transcriptChunks, setTranscriptChunks] = useState([])
  const [annotatedDocs, setAnnotatedDocs] = useState([])
  const [showAISettings, setShowAISettings] = useState(false)
  const [pipelineSteps, setPipelineSteps] = useState(null)
  const [error, setError] = useState(null)
  const [ocrFrameTexts, setOcrFrameTexts] = useState([])
  const [toolsUsed, setToolsUsed] = useState([])
  const [sceneCuts, setSceneCuts] = useState([]) // pixel-level screen-change timestamps (step boundaries)
  const [docTitle, setDocTitle] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [insights, setInsights] = useState(null)
  const [aiMode, setAiMode] = useState(null)
  const [aiModel, setAiModel] = useState(null)

  const annotateStartRef = useRef(null)
  const cancelRef = useRef(false)

  const { extractFrames } = useFrameExtractor()
  const { extractAudio } = useAudioExtractor()
  const { transcribe, cancelTranscribe, transcribeProgress } = useTranscriber()
  const { annotate } = useAnnotator()
  const { runOCR } = useOCR()
  const { parseDoc, sections: docSections, parsing: docParsing } = useDocParser()

  const updateStep = useCallback((id, updates) => {
    setPipelineSteps(prev =>
      prev?.map(s => s.id === id ? { ...s, ...updates } : s) ?? null
    )
  }, [])

  const handleCancel = useCallback(() => {
    cancelRef.current = true
    cancelTranscribe()
    setError("Processing cancelled. Whatever finished is kept below.")
    setPipelineSteps(prev => prev?.map(s =>
      s.status === 'active' ? { ...s, status: 'error', detail: 'Cancelled', endedAt: Date.now() } : s
    ) ?? null)
  }, [cancelTranscribe])

  useEffect(() => {
    if (!transcribeProgress) return
    setPipelineSteps(prev => prev?.map(s => {
      if (s.id !== 'transcribe') return s
      if (transcribeProgress.stage === 'downloading') {
        return { ...s, status: 'active', detail: 'Downloading Whisper model (~970MB, first run only — cached after)', pct: transcribeProgress.pct, startedAt: s.startedAt ?? Date.now() }
      }
      if (transcribeProgress.stage === 'transcribing') {
        const { pct, window, windows } = transcribeProgress
        const detail = windows > 1 ? `Transcribing… part ${window}/${windows}` : 'Running speech-to-text...'
        return { ...s, status: 'active', detail, pct: pct ?? null, startedAt: s.startedAt ?? Date.now() }
      }
      return s
    }) ?? null)
  }, [transcribeProgress])

  const handleVideoSelect = async (file) => {
    setError(null)
    cancelRef.current = false
    setAnnotatedDocs([])
    setTranscriptChunks([])
    setFrames([])
    setOcrFrameTexts([])
    setToolsUsed([])
    setDocTitle("")
    setInsights(null)
    setVideoFile(file)
    setPipelineSteps(INITIAL_STEPS.map((s, i) =>
      i === 0 ? { ...s, status: 'active', startedAt: Date.now() } : s
    ))

    try {
      const extracted = await extractFrames(file, 5, (i, total) =>
        updateStep('frames', { detail: `${i}/${total} frames`, pct: total ? Math.round((i / total) * 100) : null })
      )
      setFrames(extracted)
      updateStep('frames', { status: 'done', detail: `${extracted.length} frames`, pct: 100, endedAt: Date.now() })

      updateStep('audio', { status: 'active', detail: 'Reading audio track...', startedAt: Date.now() })
      const { audio, sampleRate } = await extractAudio(file)
      updateStep('audio', { status: 'done', detail: `${sampleRate / 1000}kHz mono`, endedAt: Date.now() })

      updateStep('transcribe', { status: 'active', detail: 'Loading model...', startedAt: Date.now() })
      const result = await transcribe(audio, sampleRate)
      const chunks = fixTranscriptChunks(result?.chunks ?? [])           // correct known domain mis-hearings
        .map(c => ({ ...c, text: scrubSensitive(c.text) }))               // scrub ASR mis-hears like "Hitler" before anything sees them
      setTranscriptChunks(chunks)
      if (cancelRef.current || result?.cancelled) {
        updateStep('transcribe', { status: 'error', detail: `Cancelled · ${chunks.length} segments kept`, endedAt: Date.now() })
        return
      }
      updateStep('transcribe', { status: 'done', detail: `${chunks.length} segments found`, endedAt: Date.now() })

      // OCR: read on-screen text from frames → captures exact UI labels + detects tools used
      updateStep('ocr', { status: 'active', detail: 'Reading on-screen text...', startedAt: Date.now() })
      const transcriptText = chunks.map(c => c.text).join(' ')
      const { frameTexts, tools, sceneCuts: cuts } = await runOCR(extracted, transcriptText,
        (i, total) => updateStep('ocr', { step: i + 1, total }))
      setOcrFrameTexts(frameTexts)
      setSceneCuts(cuts || [])
      setToolsUsed(tools)
      updateStep('ocr', { status: 'done', detail: tools.length ? `Tools: ${tools.join(', ')}` : `${frameTexts.length} frames read`, endedAt: Date.now() })

      if (chunks.length > 0) setShowAISettings(true)
    } catch (e) {
      setPipelineSteps(prev =>
        prev?.map(s =>
          s.status === 'active' ? { ...s, status: 'error', detail: e.message, endedAt: Date.now() } : s
        ) ?? null
      )
      setError(e.message)
    }
  }

  const handleStartAnnotation = async (aiMode, sections, model, title, company, refine = {}) => {
    setShowAISettings(false)
    setError(null)
    cancelRef.current = false
    if (title) setDocTitle(title)
    setCompanyName(company || "")
    setInsights(null)
    setAiMode(aiMode)
    setAiModel(model)
    // Server-side engines (Ollama, the bundled desktop engine) load the model
    // themselves; only WebLLM streams the load into the browser.
    const isServer = aiMode === 'ollama' || aiMode === 'local'
    const isWeb = !isServer
    // Vision: does the chosen model take screenshots? Bundled gemma3 is multimodal,
    // so vision is always on for "local".
    const useVision = aiMode === 'local' ? true
      : isWeb ? isWebLLMVision(model)
      : await ollamaModelHasVision(model)
    annotateStartRef.current = null // set when token generation actually begins

    // "Load AI Model" step: tracked live for WebLLM (download → GPU → compile →
    // ready); server engines load on their own so we just mark it ready.
    if (isWeb) {
      updateStep('loadmodel', { status: 'active', detail: 'Preparing browser AI...', pct: null, startedAt: Date.now(), endedAt: null })
    } else {
      annotateStartRef.current = Date.now()
      const engineLabel = aiMode === 'local' ? 'Bundled engine' : 'Ollama'
      updateStep('loadmodel', { status: 'done', detail: `${engineLabel} · ${model || 'gemma3'}`, startedAt: Date.now(), endedAt: Date.now() })
    }

    const modelLabel = (isWeb ? `WebLLM · ${webLLMLabel(model)}` : aiMode === 'local' ? 'Bundled · gemma3' : (model || 'ollama')) + (useVision ? ' · 👁 vision' : '')
    updateStep('annotate', {
      status: isWeb ? 'pending' : 'active',
      step: 0,
      total: transcriptChunks.length,
      etaMs: null,
      detail: `${modelLabel}${sections?.length ? ` · ${sections.length} sections` : ' · auto steps'}`,
      startedAt: isWeb ? null : Date.now(),
    })

    // Flip from "loading model" to "generating" the moment the model is ready.
    const markGenStart = () => {
      if (annotateStartRef.current) return
      annotateStartRef.current = Date.now()
      updateStep('loadmodel', { status: 'done', detail: 'Model ready on WebGPU', endedAt: Date.now() })
      updateStep('annotate', { status: 'active', startedAt: Date.now() })
    }

    try {
      const docs = await annotate(
        transcriptChunks,
        frames,
        aiMode,
        (i, total) => {
          const started = annotateStartRef.current
          let etaMs = null
          if (started && i > 0) {
            const avgMs = (Date.now() - started) / i
            etaMs = (total - i) * avgMs
          }
          updateStep('annotate', { step: i + 1, total, etaMs: etaMs > 0 ? etaMs : null })
        },
        // model-loading status (WebLLM): drive the Load AI Model step
        (msg, pct, phase) => {
          if (!isWeb) { updateStep('annotate', { detail: msg }); return }
          if (phase === 'ready') { markGenStart(); return }
          updateStep('loadmodel', { status: 'active', detail: msg, pct: pct ?? null })
        },
        sections,
        model,
        ocrFrameTexts,
        () => cancelRef.current,
        useVision,
        sceneCuts,
      )
      if (cancelRef.current) {
        setAnnotatedDocs(docs)
        updateStep('annotate', { status: 'error', detail: `Cancelled · ${docs.filter(d => d.annotation).length} done`, endedAt: Date.now() })
        return
      }
      updateStep('annotate', { status: 'done', detail: `${docs.length} entries annotated`, endedAt: Date.now() })

      // The annotator's LLM app-id READ the actual screen to name the app —
      // more reliable than the OCR regex sweep, which sees "SAP" in a garbled
      // URL and reports the generic product. Put the specific name first and
      // drop the generic hit it supersedes. Local var (not state) so the
      // insights call below sees it too.
      let effectiveTools = toolsUsed
      if (docs.appName) {
        effectiveTools = [docs.appName, ...toolsUsed.filter(
          (t) => t !== docs.appName && !docs.appName.toLowerCase().startsWith(t.toLowerCase()),
        )]
        setToolsUsed(effectiveTools)
      }

      let finalDocs = docs

      // Self-verify pass: fact-check every step against its own evidence and drop
      // anything the model can't actually support. Best-effort.
      if (refine.selfVerify && finalDocs.length > 0) {
        updateStep('verify', { status: 'active', step: 0, total: finalDocs.length, detail: 'Re-checking each step against the screen…', startedAt: Date.now() })
        const before = finalDocs.length
        try {
          finalDocs = await verifyProcedure(
            finalDocs, aiMode, model, useVision,
            (msg) => updateStep('verify', { detail: msg }),
            (i, total) => updateStep('verify', { step: i, total }),
            () => cancelRef.current,
          )
        } catch { /* keep drafts */ }
        const dropped = before - finalDocs.length
        updateStep('verify', { status: 'done', detail: dropped > 0 ? `${finalDocs.length} kept · ${dropped} unsupported removed` : `${finalDocs.length} verified`, endedAt: Date.now() })
      } else {
        updateStep('verify', { status: 'done', detail: 'Skipped', endedAt: Date.now() })
      }

      // Consolidation pass: tidy titles across the whole procedure and fold
      // adjacent duplicate phases so it reads as one coherent SOP. Best-effort.
      if (refine.consolidate && finalDocs.length > 1) {
        updateStep('consolidate', { status: 'active', detail: 'Tidying titles & merging duplicates…', startedAt: Date.now() })
        try {
          finalDocs = await consolidateProcedure(finalDocs, aiMode, model, (m) => updateStep('consolidate', { detail: m }), () => cancelRef.current)
        } catch { /* keep as-is */ }
        updateStep('consolidate', { status: 'done', detail: `${finalDocs.length} coherent steps`, endedAt: Date.now() })
      } else {
        updateStep('consolidate', { status: 'done', detail: 'Skipped', endedAt: Date.now() })
      }

      setAnnotatedDocs(finalDocs)

      // Insights pass: facilitator summary, FAQ (incl. questions asked in the
      // meeting) and a Mermaid flow diagram. Best-effort — a failure here must
      // not lose the annotations the user already has.
      updateStep('insights', { status: 'active', detail: 'Writing summary…', startedAt: Date.now() })
      try {
        const result = await generateInsights(
          finalDocs, transcriptChunks, aiMode, model,
          (msg) => updateStep('insights', { detail: msg }),
          () => cancelRef.current,
          effectiveTools,
        )
        setInsights(result)
        const bits = [
          result.summary ? 'summary' : null,
          result.faqs?.length ? `${result.faqs.length} FAQs` : null,
          result.mermaid ? 'flow' : null,
        ].filter(Boolean)
        updateStep('insights', { status: 'done', detail: bits.length ? bits.join(' · ') : 'skipped', endedAt: Date.now() })
      } catch (e) {
        updateStep('insights', { status: 'error', detail: e.message, endedAt: Date.now() })
      }
    } catch (e) {
      updateStep('annotate', { status: 'error', detail: e.message, endedAt: Date.now() })
      if (isWeb) updateStep('loadmodel', { status: 'error', detail: e.message, endedAt: Date.now() })
      setError(e.message)
    }
  }

  const handleFrameSelect = (timestamp, index) => {
    setActiveFrame(index)
    setSeekTo(timestamp)
  }

  const handleDocSeek = (timestamp) => {
    const frameIndex = frames.reduce((bestIdx, f, i) =>
      Math.abs(f.timestamp - timestamp) < Math.abs(frames[bestIdx].timestamp - timestamp) ? i : bestIdx
    , 0)
    setActiveFrame(frameIndex)
    setSeekTo(timestamp)
  }

  // ── In-app editing (so a non-technical user can fix the AI's text & export) ──
  const stepToPlain = (step) => !step ? "" : [
    step.title,
    ...(step.steps || []).map((s, i) => `${i + 1}. ${s}`),
    step.result ? `Result: ${step.result}` : "",
    step.note ? `Note: ${step.note}` : "",
  ].filter(Boolean).join("\n")

  // Save an edited step in place.
  const handleEditStep = useCallback((index, newStep) => {
    setAnnotatedDocs(prev => prev.map((d, i) =>
      i === index ? { ...d, step: newStep, annotation: stepToPlain(newStep) } : d))
  }, [])

  // Reorder a step (dir: -1 up, +1 down) and remove a step. The AI gets the
  // order right most of the time, but the human editing the doc has the final
  // say, and edits here flow into every export.
  const handleMoveStep = useCallback((index, dir) => {
    setAnnotatedDocs(prev => {
      const j = index + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }, [])

  const handleDeleteStep = useCallback((index) => {
    setAnnotatedDocs(prev => prev.filter((_, i) => i !== index))
  }, [])

  // One correction applied everywhere — fix a word/acronym once, it changes across
  // the whole document (whole-word, case-sensitive).
  const handleReplaceEverywhere = useCallback((find, replace) => {
    const f = (find || "").trim()
    if (!f || f === replace) return
    const re = new RegExp(`\\b${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g")
    const fix = (s) => typeof s === "string" ? s.replace(re, replace) : s
    setAnnotatedDocs(prev => prev.map(d => {
      if (!d.step) return d
      const st = {
        ...d.step,
        title: fix(d.step.title),
        steps: (d.step.steps || []).map(fix),
        result: fix(d.step.result),
        note: fix(d.step.note),
      }
      return { ...d, step: st, annotation: stepToPlain(st) }
    }))
  }, [])

  const isAnnotating = pipelineSteps?.find(s => s.id === 'annotate')?.status === 'active'
  const vantaRef = useVantaHalo()

  return (
    <div className="min-h-screen text-white font-mono" style={{ position: 'relative', background: '#0d0d2b' }}>
      {/* Vanta HALO fixed background — inset:0 (not 100vw) so the vertical
          scrollbar that appears during processing can't cause horizontal overflow */}
      <div ref={vantaRef} style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
      {/* Dark overlay for readability */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: 'rgba(8,5,20,0.72)', pointerEvents: 'none' }} />
      {/* Content above Vanta */}
      <div style={{ position: 'relative', zIndex: 1 }}>
      {showAISettings && (
        <AISettings
          onConfirm={handleStartAnnotation}
          onClose={() => setShowAISettings(false)}
          suggestedSections={docSections}
          toolsUsed={toolsUsed}
        />
      )}

      <header className="border-b border-white/10 px-6 py-4 flex items-center gap-3 backdrop-blur-md bg-black/20 sticky top-0 z-40">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <button
          onClick={() => { window.location.href = '/#/' }}
          className="text-lg font-semibold tracking-tight hover:text-emerald-400 transition-colors"
        >
          VideoDoc
        </button>
        <a href="/#/docchat" className="text-xs text-zinc-500 hover:text-emerald-400 transition-colors">· Doc Chat</a>

        {videoFile && !showAISettings && !isAnnotating && transcriptChunks.length > 0 && (
          <button
            onClick={() => setShowAISettings(true)}
            className="ml-auto text-xs border border-zinc-700 hover:border-emerald-500 hover:text-emerald-400 text-zinc-400 rounded-lg px-3 py-1.5 transition-all"
          >
            {annotatedDocs.length > 0 ? "Re-annotate" : "Annotate"}
          </button>
        )}

        {!videoFile && (
          <button
            onClick={() => { window.location.href = '/#/' }}
            className="text-xs text-zinc-500 hover:text-zinc-300 ml-auto transition-colors"
          >
            ← Back to home
          </button>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {!videoFile ? (
          <Uploader
            onVideoSelect={handleVideoSelect}
            onCodeSelect={() => {}}
            onDocSelect={parseDoc}
            docParsing={docParsing}
            docSections={docSections}
          />
        ) : (
          <>
            {pipelineSteps && (
              <div className="space-y-2">
                <PipelineStatus steps={pipelineSteps} />
                {pipelineSteps.some(s => s.status === 'active') && (
                  <button
                    onClick={handleCancel}
                    className="text-xs border border-red-800/60 hover:border-red-500 hover:bg-red-950/30 text-red-300 rounded-lg px-3 py-1.5 transition-all"
                  >
                    ✕ Cancel processing
                  </button>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-950/40 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <VideoPlayer file={videoFile} seekTo={seekTo} />
                <FrameStrip frames={frames} activeIndex={activeFrame} onSelect={handleFrameSelect} />
              </div>
              <div className="space-y-4">
                <DocPreview
                  transcriptChunks={transcriptChunks}
                  annotatedDocs={annotatedDocs}
                  onSeek={handleDocSeek}
                  onEditStep={handleEditStep}
                  onMoveStep={handleMoveStep}
                  onDeleteStep={handleDeleteStep}
                  onReplaceEverywhere={handleReplaceEverywhere}
                />
              </div>
            </div>

            {insights && <InsightsPanel insights={insights} onChange={setInsights} />}

            <ExportBar
              annotatedDocs={annotatedDocs}
              transcriptChunks={transcriptChunks}
              videoName={videoFile.name}
              videoFile={videoFile}
              docTitle={docTitle}
              companyName={companyName}
              insights={insights}
              toolsUsed={toolsUsed}
              frames={frames}
            />

            {(annotatedDocs.length > 0 || transcriptChunks.length > 0) && (
              <DocChat
                docs={annotatedDocs.length > 0 ? annotatedDocs : transcriptChunks.map(c => {
                  const ts = c.timestamp?.[0] ?? 0
                  const m = Math.floor(ts / 60).toString().padStart(2, "0")
                  const s = Math.floor(ts % 60).toString().padStart(2, "0")
                  const fr = frames.length
                    ? frames.reduce((b, f) => Math.abs(f.timestamp - ts) < Math.abs(b.timestamp - ts) ? f : b, frames[0])
                    : null
                  return { label: `${m}:${s}`, text: c.text, timestamp: ts, frame: fr?.imageData ?? null, annotation: null }
                })}
                aiMode={aiMode || "webllm"}
                ollamaModel={aiModel}
                onSeek={handleDocSeek}
              />
            )}
          </>
        )}
      </main>
      </div>
    </div>
  )
}
