import { useEffect, useRef, useState } from 'react'

function useIsMobile() {
  const [mobile, setMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 640)
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth <= 640)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return mobile
}

const CSS = `
  @keyframes pd-fadein {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pd-fadeout {
    from { opacity: 1; }
    to   { opacity: 0; }
  }
  @keyframes pd-bar {
    from { width: 0%; }
    to   { width: 100%; }
  }
  @keyframes pd-pulse-dot {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }
  @keyframes pd-slide-in {
    from { opacity: 0; transform: translateX(20px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes pd-model-glow {
    0%, 100% { box-shadow: 0 0 10px currentColor, 0 0 20px currentColor; }
    50%       { box-shadow: 0 0 20px currentColor, 0 0 40px currentColor; }
  }
  .pd-step-in   { animation: pd-fadein 0.4s ease forwards; }
  .pd-phase     { animation: pd-fadein 0.35s ease forwards; }
  .pd-slide-in  { animation: pd-slide-in 0.35s ease forwards; }

  @media (max-width: 640px) {
    .pd-content { padding: 14px !important; height: 420px !important; }
  }
`

const MODELS = [
  { name: 'Llama 3.2',    tag: 'Ollama',  icon: '🦙', color: '#3f62ff', strong: true  },
  { name: 'Llama 3.1 8B', tag: 'Ollama',  icon: '🦙', color: '#3f62ff', strong: true  },
  { name: 'Mistral 7B',   tag: 'Ollama',  icon: '🌊', color: '#06b6d4', strong: true  },
  { name: 'Mistral Nemo', tag: 'Ollama',  icon: '🌊', color: '#06b6d4', strong: false },
  { name: 'Gemma 3',      tag: 'Ollama',  icon: '💎', color: '#a78bfa', strong: false },
  { name: 'DeepSeek R1',  tag: 'Ollama',  icon: '🔬', color: '#f472b6', strong: true  },
  { name: 'Phi-3 Mini',   tag: 'Ollama',  icon: '⚡', color: '#fbbf24', strong: false },
  { name: 'WebLLM',       tag: 'Browser', icon: '🌐', color: '#86efac', strong: false },
]

const PHASES = [
  { id: 'upload',   duration: 3200 },
  { id: 'pipeline', duration: 5800 },
  { id: 'output',   duration: 4500 },
]

function UploadPhase({ progress }) {
  const pct = Math.floor(progress * 100)
  return (
    <div className="pd-phase" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Drop zone */}
      <div style={{
        border: '1.5px dashed rgba(63,98,255,0.45)', borderRadius: 12,
        padding: '18px 16px', textAlign: 'center',
        background: 'rgba(63,98,255,0.05)',
      }}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>🎥</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>product-walkthrough.mp4</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>24.3 MB</div>
      </div>
      {/* Progress */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            {pct < 100 ? 'Loading into memory...' : 'Ready to process ✓'}
          </span>
          <span style={{ fontSize: 11, color: '#3f62ff', fontWeight: 600 }}>{pct}%</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`, borderRadius: 2,
            background: 'linear-gradient(90deg, #3f62ff, #a78bfa)',
            transition: 'width 0.1s linear',
          }} />
        </div>
      </div>
    </div>
  )
}

const PIPELINE_STEPS = [
  { label: 'Extract Frames',    detail: '48 frames captured',     color: '#3f62ff',  revealAt: 0 },
  { label: 'Extract Audio',     detail: '16kHz mono · 2.4MB',     color: '#a78bfa',  revealAt: 900 },
  { label: 'Whisper Transcribing', detail: null,                  color: '#06b6d4',  revealAt: 1700 },
  { label: 'AI Annotating',     detail: null,                      color: '#fbbf24',  revealAt: 4000 },
]

function PipelinePhase({ elapsed }) {
  const isMobile = useIsMobile()
  const modelCount = isMobile ? 3 : 5
  const transcribeProgress = elapsed < 1700 ? 0 : Math.min((elapsed - 1700) / 2100, 1)
  const annotateStep = elapsed < 4000 ? 0 : Math.floor(((elapsed - 4000) / 1600) * 8)

  return (
    <div className="pd-phase" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {PIPELINE_STEPS.map((step, i) => {
        const visible = elapsed >= step.revealAt
        if (!visible) return (
          <div key={i} style={{ height: 38, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }} />
        )
        const done = (i === 0 && elapsed > 800) || (i === 1 && elapsed > 1600) || (i === 2 && transcribeProgress >= 1) || (i === 3 && annotateStep >= 8)
        return (
          <div key={i} className="pd-step-in" style={{
            padding: '9px 12px', borderRadius: 8,
            background: `${step.color}10`,
            border: `1px solid ${step.color}28`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 14 }}>
              {done ? '✅' : <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: step.color, animation: 'pd-pulse-dot 1s ease-in-out infinite' }} />}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: step.color, letterSpacing: '0.04em' }}>{step.label}</div>
              {done && step.detail && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{step.detail}</div>
              )}
              {i === 2 && !done && visible && (
                <div style={{ marginTop: 5, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${transcribeProgress * 100}%`, background: '#06b6d4', borderRadius: 2, transition: 'width 0.1s linear' }} />
                </div>
              )}
              {i === 3 && visible && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2, marginBottom: 6 }}>
                    {done ? '8 / 8 segments annotated' : `${annotateStep} / 8 segments...`}
                  </div>
                  {/* LLM carousel — fewer items on phone so it never overflows */}
                  <div style={{ display: 'flex', gap: 4, overflow: 'hidden' }}>
                    {MODELS.slice(0, modelCount).map((m, mi) => {
                      const active = Math.floor(((elapsed - 4000) / 280)) % modelCount === mi
                      return (
                        <div key={mi} className="pd-slide-in" style={{
                          flex: 1, minWidth: 0,
                          padding: '4px 5px', borderRadius: 6,
                          background: active ? `${m.color}22` : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${active ? m.color + '55' : 'rgba(255,255,255,0.08)'}`,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                          transition: 'all 0.2s ease',
                          animationDelay: `${mi * 0.06}s`, opacity: 0,
                          transform: active ? 'scale(1.06)' : 'scale(1)',
                        }}>
                          <span style={{ fontSize: 14 }}>{m.icon}</span>
                          <span style={{
                            fontSize: 8, fontWeight: 600, color: active ? m.color : 'rgba(255,255,255,0.35)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            maxWidth: '100%', textAlign: 'center',
                          }}>{m.name}</span>
                          <span style={{ fontSize: 7, color: active ? m.color + 'aa' : 'rgba(255,255,255,0.18)' }}>{m.tag}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const EXPORTS = [
  {
    icon: '🌐', label: 'HTML Guide', color: '#06b6d4',
    desc: 'Beautiful, shareable web page. Anyone can open it.',
    revealAt: 300,
  },
  {
    icon: '📄', label: 'PDF', color: '#a78bfa',
    desc: 'Send it, print it, attach it to an email. Done.',
    revealAt: 900,
  },
  {
    icon: '📝', label: 'DOCX', color: '#fbbf24',
    desc: 'Opens in Word, Notion, Google Docs. Fully editable.',
    revealAt: 1500,
  },
]

function OutputPhase({ elapsed }) {
  return (
    <div className="pd-phase" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {/* Success header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 8,
        background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
      }}>
        <span style={{ fontSize: 15 }}>✅</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#86efac' }}>Your documentation is ready</div>
          <div style={{ fontSize: 10, color: 'rgba(134,239,172,0.6)', marginTop: 1 }}>Pick a format and share it with anyone</div>
        </div>
      </div>

      {/* Export format cards */}
      {EXPORTS.map((ex, i) => (
        elapsed > ex.revealAt ? (
          <div key={i} className="pd-step-in" style={{
            padding: '10px 12px', borderRadius: 8,
            background: `${ex.color}0d`,
            border: `1px solid ${ex.color}28`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18, filter: `drop-shadow(0 0 6px ${ex.color})` }}>{ex.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: ex.color }}>{ex.label}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{ex.desc}</div>
            </div>
            <div style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
              background: `${ex.color}18`, border: `1px solid ${ex.color}40`, color: ex.color,
            }}>Export</div>
          </div>
        ) : (
          <div key={i} style={{ height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.025)' }} />
        )
      ))}
    </div>
  )
}

export default function ProductDemo() {
  const [phase, setPhase] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())
  const rafRef = useRef(null)

  useEffect(() => {
    startRef.current = Date.now()
    setElapsed(0)

    const tick = () => {
      const e = Date.now() - startRef.current
      setElapsed(e)
      if (e >= PHASES[phase].duration) {
        setPhase(p => (p + 1) % PHASES.length)
      } else {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase])

  const phaseLabels = ['Uploading', 'Processing', 'Done']

  return (
    <>
      <style>{CSS}</style>
      <div style={{
        background: 'rgba(13,10,35,0.85)',
        border: '1px solid rgba(63,98,255,0.18)',
        borderRadius: 18, overflow: 'hidden',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(63,98,255,0.06)',
        maxWidth: 720, width: '100%',
      }}>
        {/* Window chrome */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(0,0,0,0.2)',
        }}>
          {['#ff5f57','#ffbd2e','#28ca41'].map((c,i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
          ))}
          {/* Phase indicator tabs */}
          <div style={{ marginLeft: 12, display: 'flex', gap: 4 }}>
            {phaseLabels.map((label, i) => (
              <div key={i} style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                background: i === phase ? 'rgba(63,98,255,0.25)' : 'transparent',
                color: i === phase ? '#7b96ff' : 'rgba(255,255,255,0.25)',
                border: `1px solid ${i === phase ? 'rgba(63,98,255,0.35)' : 'transparent'}`,
                transition: 'all 0.3s ease',
              }}>{label}</div>
            ))}
          </div>
        </div>

        {/* Phase content — fixed height prevents layout shift */}
        <div className="pd-content" style={{ padding: '20px', height: 380, overflow: 'hidden' }}>
          {phase === 0 && <UploadPhase progress={elapsed / PHASES[0].duration} />}
          {phase === 1 && <PipelinePhase elapsed={elapsed} />}
          {phase === 2 && <OutputPhase elapsed={elapsed} />}
        </div>
      </div>
    </>
  )
}
