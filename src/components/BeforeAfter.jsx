import { useEffect, useRef, useState } from 'react'

const CSS = `
  @keyframes ba-wave {
    0%, 100% { transform: scaleY(0.4); }
    50%       { transform: scaleY(1); }
  }
  @keyframes ba-blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }
  @keyframes ba-tab-in {
    from { opacity: 0; transform: translateY(5px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ba-click-ring {
    0%   { transform: scale(0.3); opacity: 0.9; }
    100% { transform: scale(2.8); opacity: 0; }
  }
  @keyframes ba-step-reveal {
    from { opacity: 0; transform: translateX(12px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes ba-result-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.3); }
    50%       { box-shadow: 0 0 16px 4px rgba(245,158,11,0.15); }
  }
  @keyframes ba-pdf-line {
    from { width: 0%; }
    to   { width: 100%; }
  }
  @keyframes ba-cursor-appear {
    from { opacity: 0; transform: scale(0.5); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes ba-step-type {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .ba-tab-content { animation: ba-tab-in 0.3s ease forwards; }
  .ba-step { animation: ba-step-reveal 0.4s ease forwards; opacity: 0; }

  @media (max-width: 640px) {
    .ba-frame { height: 500px !important; }
  }
`

const WAVE_DELAYS  = [0,.2,.1,.35,.05,.28,.15,.4,.08,.22,.33,.12,.38,.18,.3,.07,.25,.42,.03,.17]
const WAVE_HEIGHTS = [.5,.8,.4,1,.6,.9,.3,.7,1,.5,.85,.45,.7,.95,.35,.6,.8,.5,.9,.65]

// Generic, relatable steps (not technical)
// cursor = position the cursor moves to on the left screen mockup (% of panel)
const STEPS = [
  { text: 'Open the app and go to Settings',        cursor: { x: 50, y: 22 }, label: 'Settings ⚙️' },
  { text: 'Tap on your profile photo to change it', cursor: { x: 50, y: 50 }, label: 'Profile 👤' },
  { text: 'Choose a new photo from your gallery',   cursor: { x: 50, y: 78 }, label: 'Gallery 🖼️' },
]
const RESULT_TEXT = 'Profile updated and saved successfully.'

/* ─────────────────────────────────────────────
   HTML Preview — split panel: animated screen
   recording (left) drives the steps (right),
   exactly like the real VideoDoc HTML export
──────────────────────────────────────────────── */
function HTMLPreview() {
  const [step, setStep] = useState(0)
  const [clicking, setClicking] = useState(false)

  useEffect(() => {
    const advance = () => {
      // click pulse fires when cursor reaches the target
      setTimeout(() => setClicking(true), 750)
      setTimeout(() => setClicking(false), 1150)
      setTimeout(() => setStep(s => (s + 1) % STEPS.length), 1900)
    }
    advance()
    const t = setInterval(advance, 2200)
    return () => clearInterval(t)
  }, [])

  const cur = STEPS[step].cursor

  return (
    <div className="ba-tab-content" style={{
      height: '100%', display: 'flex',
      background: '#faf6f0', borderRadius: 10, overflow: 'hidden',
      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
    }}>
      {/* ── LEFT: animated screen recording ── */}
      <div style={{
        width: '46%', position: 'relative',
        background: 'linear-gradient(160deg, #1e293b, #0f172a)',
        borderRight: '1px solid rgba(0,0,0,0.1)',
        padding: '10px 8px', overflow: 'hidden',
      }}>
        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 700 }}>
          ● REC · screen
        </div>

        {/* Mock app rows that the cursor clicks */}
        {STEPS.map((s, i) => {
          const isTarget = i === step
          return (
            <div key={i} style={{
              padding: '8px 9px', borderRadius: 6, marginBottom: 6,
              background: isTarget && clicking ? 'rgba(13,148,136,0.35)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${isTarget ? 'rgba(13,148,136,0.5)' : 'rgba(255,255,255,0.08)'}`,
              fontSize: 9, fontWeight: 600,
              color: isTarget ? '#5eead4' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.2s ease',
              transform: isTarget && clicking ? 'scale(0.97)' : 'scale(1)',
            }}>
              {s.label}
            </div>
          )
        })}

        {/* Animated cursor */}
        <div style={{
          position: 'absolute',
          left: `${cur.x}%`, top: `${cur.y}%`,
          transform: 'translate(-50%, -50%)',
          transition: 'top 0.7s cubic-bezier(.4,0,.2,1), left 0.7s cubic-bezier(.4,0,.2,1)',
          zIndex: 5, pointerEvents: 'none',
        }}>
          {/* click ripple */}
          {clicking && (
            <div style={{
              position: 'absolute', left: 0, top: 0,
              width: 22, height: 22, marginLeft: -11, marginTop: -11,
              borderRadius: '50%', border: '2px solid #2dd4bf',
              animation: 'ba-click-ring 0.4s ease forwards',
            }} />
          )}
          {/* cursor arrow */}
          <svg width="16" height="16" viewBox="0 0 16 16" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
            <path d="M2 1 L2 13 L5.5 9.5 L8 14 L10 13 L7.5 8.5 L12 8.5 Z" fill="#fff" stroke="#0d9488" strokeWidth="0.8" />
          </svg>
        </div>
      </div>

      {/* ── RIGHT: synced step appears ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0d9488' }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: '#57534e', letterSpacing: '0.06em' }}>Step-by-Step Guide</span>
          <span style={{ marginLeft: 'auto', fontSize: 8, color: '#a8a29e' }}>auto-generated</span>
        </div>

        {/* The current step, re-keyed so it animates in each change */}
        <div key={step} style={{ animation: 'ba-step-type 0.45s ease forwards' }}>
          <div style={{
            padding: '12px 12px', borderRadius: 9,
            background: 'rgba(13,148,136,0.08)',
            border: '1px solid rgba(13,148,136,0.3)',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{
              fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 5, flexShrink: 0,
              background: '#0d9488', color: '#fff',
            }}>0{step + 1}</span>
            <span style={{ fontSize: 12, color: '#1c1917', fontWeight: 600, lineHeight: 1.4 }}>
              {STEPS[step].text}
            </span>
          </div>

          {/* mini screenshot for this step */}
          <div style={{
            marginTop: 8, height: 46, borderRadius: 7,
            background: 'linear-gradient(135deg, #e8f4f0, #ddf0ec)',
            border: '1px solid rgba(13,148,136,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, color: '#0d9488', fontWeight: 600, letterSpacing: '0.06em',
          }}>
            📸 captured frame · step {step + 1}
          </div>
        </div>

        {/* progress dots */}
        <div style={{ display: 'flex', gap: 5, marginTop: 'auto', paddingTop: 10, justifyContent: 'center' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 16 : 5, height: 5, borderRadius: 3,
              background: i === step ? '#0d9488' : 'rgba(0,0,0,0.15)',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        {/* footer */}
        <div style={{
          marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.06)',
          fontSize: 8, color: '#a8a29e', letterSpacing: '0.05em',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>ANIMATED HTML</span>
          <span style={{ color: '#0d9488' }}>Share · Print · Download</span>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   PDF Preview — clean white document page
──────────────────────────────────────────────── */
function PDFPreview() {
  return (
    <div className="ba-tab-content" style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: '#ffffff', borderRadius: 10, overflow: 'hidden',
      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
    }}>
      {/* PDF toolbar */}
      <div style={{
        padding: '6px 10px', background: '#3c3c3c',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ fontSize: 10 }}>📄</span>
        <span style={{ fontSize: 9, color: '#d4d4d4', fontWeight: 600 }}>Step-by-Step-Guide.pdf</span>
        <button style={{
          marginLeft: 'auto', padding: '3px 10px', borderRadius: 4,
          background: 'rgba(255,255,255,0.15)', border: 'none',
          color: '#fff', fontSize: 9, fontWeight: 600, cursor: 'default',
          animation: 'ba-result-glow 2.5s ease-in-out infinite',
        }}>📤 Share</button>
      </div>

      {/* Page */}
      <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Doc title */}
        <div>
          <div style={{ height: 10, width: '65%', borderRadius: 3, background: '#1c1917', marginBottom: 4 }} />
          <div style={{ height: 5, width: '45%', borderRadius: 2, background: '#d6d3d1' }} />
        </div>
        <div style={{ height: 1, background: '#e7e5e4', margin: '2px 0' }} />

        {/* Steps */}
        {STEPS.map((s, i) => (
          <div key={i} className="ba-step" style={{ animationDelay: `${i * 0.2}s`, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
              background: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 8, color: '#fff', fontWeight: 800 }}>{i+1}</span>
            </div>
            <div>
              <div style={{ height: 6, borderRadius: 2, background: '#374151', marginBottom: 3, animation: `ba-pdf-line 0.6s ease ${i * 0.2 + 0.3}s forwards`, width: 0 }} />
              <div style={{ height: 4, borderRadius: 2, background: '#d1d5db', width: `${40 + i * 8}%` }} />
            </div>
          </div>
        ))}

        <div style={{ height: 1, background: '#e7e5e4', margin: '2px 0' }} />

        {/* Result */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 8px', borderRadius: 5, background: '#fef9ee', border: '1px solid #fde68a' }}>
          <span style={{ fontSize: 12 }}>✅</span>
          <div style={{ height: 5, borderRadius: 2, background: '#92400e', width: '70%' }} />
        </div>
      </div>

      <div style={{
        padding: '5px 10px', background: '#f5f5f4', borderTop: '1px solid #e7e5e4',
        fontSize: 8, color: '#a8a29e', letterSpacing: '0.06em',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>PDF · PAGE 1 OF 1</span>
        <span style={{ color: '#a78bfa' }}>Ready to send · Opens anywhere</span>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   DOCX Preview — Microsoft Word-like document
──────────────────────────────────────────────── */
function DOCXPreview() {
  const [cursorLine, setCursorLine] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setCursorLine(l => (l + 1) % STEPS.length), 1500)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="ba-tab-content" style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: '#fff', borderRadius: 10, overflow: 'hidden',
      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
    }}>
      {/* Word toolbar */}
      <div style={{ background: '#2b579a', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11 }}>📝</span>
        <span style={{ fontSize: 9, color: '#fff', fontWeight: 600 }}>Step-by-Step-Guide.docx</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {['B', 'I', 'U'].map(f => (
            <div key={f} style={{ width: 16, height: 16, borderRadius: 2, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 700 }}>{f}</div>
          ))}
        </div>
      </div>

      {/* Ruler */}
      <div style={{ height: 10, background: '#f3f3f3', borderBottom: '1px solid #e0e0e0', position: 'relative' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ position: 'absolute', left: `${10 + i * 16}%`, top: 0, bottom: 0, width: 1, background: 'rgba(0,0,0,0.1)' }} />
        ))}
      </div>

      {/* Document page */}
      <div style={{ flex: 1, padding: '12px 18px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Title */}
        <div style={{ height: 9, width: '55%', borderRadius: 2, background: '#1e3a5f', marginBottom: 4 }} />

        {STEPS.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 0', borderBottom: '1px solid #f5f5f5' }}>
            <div style={{
              width: 16, height: 16, borderRadius: 2, flexShrink: 0,
              background: i === cursorLine ? '#fbbf24' : '#e0e7ff',
              border: `1px solid ${i === cursorLine ? '#f59e0b' : '#c7d2fe'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s',
            }}>
              <span style={{ fontSize: 8, fontWeight: 800, color: i === cursorLine ? '#92400e' : '#4f46e5' }}>{i+1}</span>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{
                height: 5, borderRadius: 2, background: i === cursorLine ? '#374151' : '#9ca3af',
                width: `${60 + i * 8}%`, transition: 'all 0.3s',
              }} />
              {i === cursorLine && (
                <div style={{ width: 1.5, height: 10, background: '#2b579a', animation: 'ba-blink 0.75s ease-in-out infinite' }} />
              )}
            </div>
          </div>
        ))}

        {/* Result */}
        <div style={{ marginTop: 4, padding: '5px 8px', borderRadius: 4, background: '#f0fdf4', border: '1px solid #86efac', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11 }}>✅</span>
          <div style={{ height: 4, borderRadius: 2, background: '#166534', width: '65%' }} />
        </div>
      </div>

      <div style={{
        padding: '5px 10px', background: '#f3f3f3', borderTop: '1px solid #e0e0e0',
        fontSize: 8, color: '#9ca3af', letterSpacing: '0.06em',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>WORD · DOCX FORMAT</span>
        <span style={{ color: '#fbbf24' }}>Edit · Paste into Notion / Google Docs</span>
      </div>
    </div>
  )
}

const TABS = [
  { id: 'html', label: '🌐 HTML', color: '#0d9488' },
  { id: 'pdf',  label: '📄 PDF',  color: '#a78bfa' },
  { id: 'docx', label: '📝 DOCX', color: '#2b579a' },
]

export default function BeforeAfter() {
  const [pos, setPos] = useState(48)
  const [activeTab, setActiveTab] = useState(0)
  const containerRef = useRef(null)
  const dragging = useRef(false)

  useEffect(() => {
    const t = setInterval(() => setActiveTab(tab => (tab + 1) % TABS.length), 5000)
    return () => clearInterval(t)
  }, [])

  const getPos = (clientX) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setPos(Math.max(8, Math.min(92, ((clientX - rect.left) / rect.width) * 100)))
  }

  useEffect(() => {
    const onUp   = () => { dragging.current = false }
    const onMove = (e) => { if (dragging.current) getPos(e.clientX) }
    window.addEventListener('mouseup', onUp)
    window.addEventListener('mousemove', onMove)
    return () => { window.removeEventListener('mouseup', onUp); window.removeEventListener('mousemove', onMove) }
  }, [])

  const tab = TABS[activeTab]

  return (
    <>
      <style>{CSS}</style>
      <div
        ref={containerRef}
        className="ba-frame"
        onTouchMove={e => getPos(e.touches[0].clientX)}
        style={{
          position: 'relative', height: 460, borderRadius: 18, overflow: 'hidden',
          cursor: 'col-resize', userSelect: 'none',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
        }}
      >
        {/* LEFT: Before */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #0a0818, #12103a)',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '24px 28px',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', marginBottom: 16 }}>Before</div>

          <div style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 7, flexShrink: 0, background: 'rgba(63,98,255,0.15)', border: '1px solid rgba(63,98,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🎥</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>raw-recording.mp4</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>24.3 MB · 08:32 · unstructured</div>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.18)', marginBottom: 7, letterSpacing: '0.08em' }}>AUDIO WAVEFORM</div>
            <div style={{ display: 'flex', alignItems: 'center', height: 44, gap: 2 }}>
              {WAVE_HEIGHTS.map((h, i) => (
                <div key={i} style={{ flex: 1, background: 'rgba(63,98,255,0.45)', borderRadius: 1, animation: `ba-wave ${0.8 + WAVE_DELAYS[i]}s ease-in-out infinite`, animationDelay: `${WAVE_DELAYS[i]}s`, transformOrigin: 'bottom', height: `${h * 100}%` }} />
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.18)', marginBottom: 7, letterSpacing: '0.08em' }}>FRAMES — no structure, no steps</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ flex: 1, aspectRatio: '16/9', borderRadius: 5, background: `rgba(${60+i*12},${38+i*8},${78+i*18},0.4)`, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: 'rgba(255,255,255,0.22)' }}>{String(i*2).padStart(2,'0')}:00</div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: After — clipped */}
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, left: `${pos}%`,
          background: '#1a1a2e',
          display: 'flex', flexDirection: 'column', padding: '16px 20px', overflow: 'hidden',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: tab.color, marginBottom: 10, transition: 'color 0.3s' }}>VideoDoc Output</div>

          {/* Format tabs */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
            {TABS.map((t, i) => (
              <button key={t.id} onClick={() => setActiveTab(i)} style={{
                flex: 1, padding: '5px 0', borderRadius: 7,
                background: i === activeTab ? `${t.color}18` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${i === activeTab ? t.color + '50' : 'rgba(255,255,255,0.07)'}`,
                color: i === activeTab ? t.color : 'rgba(255,255,255,0.28)',
                fontSize: 10, fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s',
              }}>{t.label}</button>
            ))}
          </div>

          {/* Animated output preview */}
          <div key={activeTab} style={{ flex: 1, overflow: 'hidden' }}>
            {activeTab === 0 && <HTMLPreview />}
            {activeTab === 1 && <PDFPreview />}
            {activeTab === 2 && <DOCXPreview />}
          </div>
        </div>

        {/* Draggable handle */}
        <div
          onMouseDown={() => { dragging.current = true }}
          onTouchStart={() => { dragging.current = true }}
          style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos}%`, transform: 'translateX(-50%)', width: 2, background: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'col-resize', zIndex: 10 }}
        >
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 4px rgba(255,255,255,0.12), 0 4px 14px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#0d0d2b', fontWeight: 700, userSelect: 'none', letterSpacing: '-1px' }}>‹›</div>
        </div>

        <div style={{ position: 'absolute', top: 12, left: 14, fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', pointerEvents: 'none' }}>RAW VIDEO</div>
        <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 8, fontWeight: 700, color: tab.color, letterSpacing: '0.1em', pointerEvents: 'none', transition: 'color 0.3s' }}>VIDEODOC</div>
      </div>
    </>
  )
}
