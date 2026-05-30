import { useState, useRef, useEffect, useCallback } from "react"
import Uploader from "./components/Uploader"
import VideoPlayer from "./components/VideoPlayer"
import DocPreview from "./components/DocPreview"
import ExportBar from "./components/ExportBar"
import FrameStrip from "./components/FrameStrip"
import AISettings from "./components/AISettings"
import PipelineStatus from "./components/PipelineStatus"
import useFrameExtractor from "./hooks/useFrameExtractor"
import useAudioExtractor from "./hooks/useAudioExtractor"
import useTranscriber from "./hooks/useTranscriber"
import useAnnotator from "./hooks/useAnnotator"
import useDocParser from "./hooks/useDocParser"
import useVantaHalo from "./hooks/useVantaHalo"

const INITIAL_STEPS = [
  { id: 'frames',     label: 'Extract Frames',   status: 'pending', detail: null },
  { id: 'audio',      label: 'Extract Audio',     status: 'pending', detail: null },
  { id: 'transcribe', label: 'Transcribe Audio',  status: 'pending', detail: null, pct: null },
  { id: 'annotate',   label: 'Annotate Segments', status: 'pending', detail: null, pct: null, step: null, total: null, etaMs: null },
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

  const annotateStartRef = useRef(null)

  const { extractFrames } = useFrameExtractor()
  const { extractAudio } = useAudioExtractor()
  const { transcribe, transcribeProgress } = useTranscriber()
  const { annotate } = useAnnotator()
  const { parseDoc, sections: docSections, parsing: docParsing } = useDocParser()

  const updateStep = useCallback((id, updates) => {
    setPipelineSteps(prev =>
      prev?.map(s => s.id === id ? { ...s, ...updates } : s) ?? null
    )
  }, [])

  useEffect(() => {
    if (!transcribeProgress) return
    setPipelineSteps(prev => prev?.map(s => {
      if (s.id !== 'transcribe') return s
      if (transcribeProgress.stage === 'downloading') {
        return { ...s, status: 'active', detail: 'Downloading Whisper model (~150MB, first run only)', pct: transcribeProgress.pct, startedAt: s.startedAt ?? Date.now() }
      }
      if (transcribeProgress.stage === 'transcribing') {
        return { ...s, status: 'active', detail: 'Running speech-to-text...', pct: null, startedAt: s.startedAt ?? Date.now() }
      }
      return s
    }) ?? null)
  }, [transcribeProgress])

  const handleVideoSelect = async (file) => {
    setError(null)
    setAnnotatedDocs([])
    setTranscriptChunks([])
    setFrames([])
    setVideoFile(file)
    setPipelineSteps(INITIAL_STEPS.map((s, i) =>
      i === 0 ? { ...s, status: 'active', startedAt: Date.now() } : s
    ))

    try {
      const extracted = await extractFrames(file, 5)
      setFrames(extracted)
      updateStep('frames', { status: 'done', detail: `${extracted.length} frames`, endedAt: Date.now() })

      updateStep('audio', { status: 'active', detail: 'Reading audio track...', startedAt: Date.now() })
      const { audio, sampleRate } = await extractAudio(file)
      updateStep('audio', { status: 'done', detail: `${sampleRate / 1000}kHz mono`, endedAt: Date.now() })

      updateStep('transcribe', { status: 'active', detail: 'Loading model...', startedAt: Date.now() })
      const result = await transcribe(audio, sampleRate)
      const chunks = result?.chunks ?? []
      setTranscriptChunks(chunks)
      updateStep('transcribe', { status: 'done', detail: `${chunks.length} segments found`, endedAt: Date.now() })

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

  const handleStartAnnotation = async (aiMode, sections, ollamaModel) => {
    setShowAISettings(false)
    setError(null)
    const startedAt = Date.now()
    annotateStartRef.current = startedAt
    const modelLabel = aiMode === 'ollama' ? (ollamaModel || 'ollama') : 'WebLLM'
    updateStep('annotate', {
      status: 'active',
      step: 0,
      total: transcriptChunks.length,
      etaMs: null,
      detail: `${modelLabel}${sections?.length ? ` · ${sections.length} sections` : ' · auto steps'}`,
      startedAt,
    })

    try {
      const docs = await annotate(
        transcriptChunks,
        frames,
        aiMode,
        (i, total) => {
          const elapsed = Date.now() - annotateStartRef.current
          const avgMs = elapsed / (i + 1)
          const etaMs = (total - i - 1) * avgMs
          updateStep('annotate', { step: i + 1, total, etaMs: etaMs > 0 ? etaMs : null })
        },
        (msg) => updateStep('annotate', { detail: msg }),
        sections,
        ollamaModel
      )
      setAnnotatedDocs(docs)
      updateStep('annotate', { status: 'done', detail: `${docs.length} entries annotated`, endedAt: Date.now() })
    } catch (e) {
      updateStep('annotate', { status: 'error', detail: e.message, endedAt: Date.now() })
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
            {pipelineSteps && <PipelineStatus steps={pipelineSteps} />}

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
                />
              </div>
            </div>

            <ExportBar
              annotatedDocs={annotatedDocs}
              transcriptChunks={transcriptChunks}
              videoName={videoFile.name}
              frames={frames}
            />
          </>
        )}
      </main>
      </div>
    </div>
  )
}
