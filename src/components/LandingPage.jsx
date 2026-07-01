import { useEffect, useRef, useState } from 'react'
import VideoDocLogo from './VideoDocLogo'
import ProductDemo from './ProductDemo'
import BeforeAfter from './BeforeAfter'
import DocChatDemo from './DocChatDemo'

// Primary: #3f62ff (electric blue)  Secondary: #a78bfa (violet)
// Accent:  #06b6d4 (cyan)           Warm:      #fbbf24 (amber)

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');

  @keyframes lp-float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    33%       { transform: translateY(-18px) rotate(0.7deg); }
    66%       { transform: translateY(9px) rotate(-0.4deg); }
  }
  @keyframes lp-floatB {
    0%, 100% { transform: translateY(0px) translateX(0px); }
    50%       { transform: translateY(-24px) translateX(10px); }
  }
  @keyframes lp-pulse {
    0%, 100% { box-shadow: 0 0 24px rgba(63,98,255,0.4), 0 0 48px rgba(63,98,255,0.14); }
    50%       { box-shadow: 0 0 52px rgba(63,98,255,0.7), 0 0 96px rgba(63,98,255,0.28); }
  }
  @keyframes lp-pulse-green {
    0%, 100% { box-shadow: 0 0 24px rgba(52,211,153,0.4), 0 0 48px rgba(52,211,153,0.14); }
    50%       { box-shadow: 0 0 52px rgba(52,211,153,0.72), 0 0 96px rgba(52,211,153,0.28); }
  }
  @keyframes lp-shimmer {
    0%   { background-position: 0% center; }
    100% { background-position: 200% center; }
  }
  @keyframes lp-leave {
    to { opacity: 0; transform: scale(1.03); }
  }
  @keyframes lp-dot-blink {
    0%, 100% { opacity: 1; } 50% { opacity: 0.3; }
  }
  @keyframes lp-badge-glow {
    0%, 100% { box-shadow: 0 0 12px rgba(63,98,255,0.3); }
    50%       { box-shadow: 0 0 24px rgba(63,98,255,0.6), 0 0 48px rgba(63,98,255,0.18); }
  }

  .lp-card {
    transition: transform 0.35s cubic-bezier(.22,1,.36,1),
                border-color 0.3s ease, box-shadow 0.3s ease;
  }
  .lp-card:hover {
    transform: translateY(-12px) scale(1.025) !important;
    border-color: rgba(63,98,255,0.4) !important;
    box-shadow: 0 28px 64px rgba(63,98,255,0.14),
                0 0 0 1px rgba(63,98,255,0.1),
                inset 0 1px 0 rgba(255,255,255,0.06) !important;
  }
  .lp-cta {
    transition: transform 0.25s ease, box-shadow 0.25s ease;
  }
  .lp-cta:hover {
    transform: scale(1.07);
    box-shadow: 0 0 60px rgba(63,98,255,0.65), 0 0 120px rgba(63,98,255,0.25) !important;
  }
  .lp-cta-g { transition: transform 0.25s ease, box-shadow 0.25s ease; }
  .lp-cta-g:hover {
    transform: scale(1.07);
    box-shadow: 0 0 60px rgba(52,211,153,0.6), 0 0 120px rgba(52,211,153,0.22) !important;
  }
  .lp-ghost {
    transition: border-color 0.25s, color 0.25s, background 0.25s;
  }
  .lp-ghost:hover {
    border-color: rgba(63,98,255,0.5) !important;
    color: #7b96ff !important;
    background: rgba(63,98,255,0.08) !important;
  }
  .lp-nav-btn {
    transition: background 0.2s, box-shadow 0.2s, color 0.2s;
  }
  .lp-nav-btn:hover {
    background: rgba(63,98,255,0.14) !important;
    box-shadow: 0 0 18px rgba(63,98,255,0.32) !important;
    color: #7b96ff !important;
  }

  /* ── Mobile ──────────────────────────────────────────── */
  @media (max-width: 640px) {
    .lp-nav        { padding: 14px 20px !important; }
    .lp-satellite  { display: none !important; }
    .lp-steps-line { display: none !important; }
    .lp-section    { padding: 64px 20px !important; }
    .lp-footer     { padding: 22px 20px !important; }
    .lp-mockup     { margin-top: 40px !important; }
    .lp-cta        { padding: 14px 28px !important; font-size: 0.95rem !important; }
    .lp-ghost      { padding: 14px 28px !important; font-size: 0.95rem !important; }
    .lp-fork-grid   { grid-template-columns: 1fr !important; }
    .lp-export-grid { grid-template-columns: 1fr !important; }
    .lp-v-split     { grid-template-columns: 1fr !important; }
    .lp-pipe-grid   { grid-template-columns: repeat(2, 1fr) !important; gap: 20px !important; }
  }
`

const PERSONAS = [
  {
    icon: '👨‍💻',
    role: 'Developers',
    hook: 'Stop re-explaining your codebase.',
    desc: 'Record a walkthrough once. VideoDoc turns it into onboarding docs your whole team can follow. No writing required.',
    color: '#3f62ff',
  },
  {
    icon: '👩‍🏫',
    role: 'Educators & Trainers',
    hook: 'Your tutorials deserve a second life.',
    desc: 'Every video lesson becomes a searchable, exportable step-by-step guide. Perfect for students who prefer reading over rewatching.',
    color: '#a78bfa',
  },
  {
    icon: '📋',
    role: 'Operations & PMs',
    hook: "Document before it lives only in your head.",
    desc: 'Screen-record any workflow. VideoDoc produces an SOP your team can follow: formatted, visual, and ready to share.',
    color: '#06b6d4',
  },
  {
    icon: '🎨',
    role: 'Designers & Creators',
    hook: 'Show your process, not just your output.',
    desc: 'Turn design walkthroughs and process recordings into polished case studies or client handoffs. Done in minutes.',
    color: '#fbbf24',
  },
]

const FEATURES = [
  {
    icon: '🎙',
    title: 'Accurate Transcription',
    desc: 'Whisper Small runs via WebAssembly right in your tab, sharp enough to get names, jargon and technical terms right. No API key, no rate limits, no cost per minute.',
    color: '#3f62ff',
  },
  {
    icon: '👁',
    title: 'Sees Your Screen (Vision)',
    desc: 'The AI looks at the actual screenshots, not just OCR text, so it names the exact buttons, menus and tabs, and works out "click here" by seeing where you clicked.',
    color: '#22d3ee',
  },
  {
    icon: '🎬',
    title: 'Sharp Step Clips',
    desc: 'Every step becomes a short, true-colour WebM clip of the real action. It is far clearer than a GIF, and smaller too. Built in your browser, embedded right into the HTML guide.',
    color: '#f472b6',
  },
  {
    icon: '📋',
    title: 'A Real Desktop Procedure',
    desc: 'Not loose notes, but a structured SOP: Index, Purpose, Prerequisites, numbered steps (action, result, screenshot), Key Observations, Summary, FAQ and a flow diagram.',
    color: '#a78bfa',
  },
  {
    icon: '💬',
    title: 'Vid Chat',
    desc: 'Ask your recording anything. In-browser RAG retrieves the right step and answers, with the matching frame and a jump-to-moment link. Not in the doc? It offers the AI model or a real web search. No server, no keys.',
    color: '#34d399',
  },
  {
    icon: '🔒',
    title: 'Runs Fully in Your Browser',
    desc: 'Whisper, Vision, the LLM, embeddings and clips, all client-side. Optional Ollama for power users, and zero data leaves your machine. Ever.',
    color: '#fbbf24',
  },
]

const STEPS = [
  { num: '01', label: 'Upload Your Video',     icon: '🎬', color: '#3f62ff' },
  { num: '02', label: 'Whisper Transcribes',   icon: '🎧', color: '#a78bfa' },
  { num: '03', label: 'AI Writes the Steps',   icon: '✍️',  color: '#06b6d4' },
  { num: '04', label: 'Export & Publish',       icon: '🚀', color: '#fbbf24' },
  { num: '05', label: 'Vid Chat',               icon: '💬', color: '#34d399' },
]

export default function LandingPage() {
  const vantaRef = useRef(null)
  const vantaEffect = useRef(null)
  const [ready, setReady] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [overlayOpacity, setOverlayOpacity] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 80)
    return () => clearTimeout(t)
  }, [])

  // Ramps to full dim after 60% of one viewport scroll
  useEffect(() => {
    const onScroll = () => {
      const progress = Math.min(window.scrollY / (window.innerHeight * 0.6), 1)
      setOverlayOpacity(progress * 0.92)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!vantaRef.current || !window.VANTA?.NET) return
    // Decorative only — never let a WebGL failure crash the landing page.
    try {
      vantaEffect.current = window.VANTA.NET({
        el: vantaRef.current,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        scale: 1.0,
        scaleMobile: 1.0,
        color: 0x3f62ff,
        backgroundColor: 0x23153c,
        points: 10,
        maxDistance: 20,
        spacing: 15,
        showDots: true,
      })
    } catch (e) {
      console.warn('Vanta background disabled (no WebGL):', e?.message)
    }
    return () => { try { vantaEffect.current?.destroy() } catch {} }
  }, [])

  const handleEnter = () => {
    setLeaving(true)
    setTimeout(() => { window.location.href = '/#/app' }, 550)
  }
  const handleDocChat = () => {
    setLeaving(true)
    setTimeout(() => { window.location.href = '/#/docchat' }, 550)
  }

  return (
    <>
      <style>{CSS}</style>

      {/* Vanta fixed background */}
      <div ref={vantaRef} style={{
        position: 'fixed', inset: 0,
        width: '100%', height: '100%',
        zIndex: 0,
      }} />

      {/* Scroll-linked dimmer */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'rgba(20,12,45,0.95)',
        opacity: overlayOpacity,
        transition: 'opacity 0.08s linear',
      }} />

      {/* Scanline texture */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.025) 2px, rgba(0,0,0,0.025) 4px)',
      }} />

      {/* Scrollable content */}
      <div style={{
        position: 'relative', zIndex: 3,
        minHeight: '100vh',
        color: '#fff',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        overflowX: 'hidden',
        opacity: ready ? 1 : 0,
        transition: leaving ? 'none' : 'opacity 0.9s ease',
        animation: leaving ? 'lp-leave 0.55s ease forwards' : 'none',
      }}>

        {/* ── Nav ─────────────────────────────────────────────── */}
        <nav className="lp-nav" style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          padding: '18px 40px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(35,21,60,0.75)',
          backdropFilter: 'blur(22px)',
          borderBottom: '1px solid rgba(63,98,255,0.12)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <VideoDocLogo size={30} />
            <span style={{
              fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em',
              background: 'linear-gradient(90deg, #7b96ff, #a78bfa)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>VideoDoc</span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleDocChat} className="lp-nav-btn" style={{
              padding: '9px 18px', borderRadius: 100,
              background: 'transparent', border: '1px solid rgba(52,211,153,0.4)',
              color: 'rgba(110,231,183,0.95)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            }}>
              Doc Chat
            </button>
            <button onClick={handleEnter} className="lp-nav-btn" style={{
              padding: '9px 18px', borderRadius: 100,
              background: 'transparent', border: '1px solid rgba(63,98,255,0.4)',
              color: 'rgba(123,150,255,0.95)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            }}>
              Video → Docs
            </button>
          </div>
        </nav>

        {/* ── Hero ────────────────────────────────────────────── */}
        <section style={{
          minHeight: '100vh',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          textAlign: 'center',
          padding: '110px 24px 70px',
        }}>

          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderRadius: 100,
            background: 'rgba(63,98,255,0.1)',
            border: '1px solid rgba(63,98,255,0.28)',
            fontSize: 11, color: '#7b96ff',
            letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600,
            marginBottom: 36,
            animation: 'lp-badge-glow 3.5s ease-in-out infinite',
            backdropFilter: 'blur(8px)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: '#3f62ff',
              display: 'inline-block',
              animation: 'lp-dot-blink 1.8s ease-in-out infinite',
            }} />
            Free · Private · No sign-up required
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: 'clamp(3.8rem, 11vw, 9rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.02,
            marginBottom: 28,
            background: 'linear-gradient(135deg, #ffffff 0%, #7b96ff 30%, #a78bfa 60%, #06b6d4 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundSize: '200% auto',
            animation: 'lp-shimmer 4.5s linear infinite',
          }}>
            VideoDoc
          </h1>

          <p style={{
            fontSize: 'clamp(1.1rem, 2.8vw, 1.65rem)',
            fontWeight: 300,
            color: 'rgba(255,255,255,0.75)',
            maxWidth: 600, lineHeight: 1.5, marginBottom: 16,
          }}>
            If you recorded it, we'll document it.
          </p>
          <p style={{
            fontSize: '1rem',
            color: 'rgba(255,255,255,0.68)',
            maxWidth: 540, lineHeight: 1.75, marginBottom: 52,
          }}>
            VideoDoc watches your screen recording, writes the steps, captures the frames,
            and hands you a polished guide. Then you can talk to that guide and ask it anything.
            No internet connection, no account, no subscription.
          </p>

          {/* Flow chips: Record → Document → Ask */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 40 }}>
            {[
              { icon: '🎬', label: 'Record', c: '#3f62ff' },
              { icon: '📄', label: 'Document', c: '#a78bfa' },
              { icon: '💬', label: 'Vid Chat', c: '#34d399' },
            ].map((s, i) => (
              <span key={i} style={{ display: 'contents' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 15px', borderRadius: 100, background: `${s.c}14`, border: `1px solid ${s.c}3a`, color: s.c, fontSize: '0.85rem', fontWeight: 600 }}>
                  <span style={{ fontSize: 15 }}>{s.icon}</span>{s.label}
                </span>
                {i < 2 && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>→</span>}
              </span>
            ))}
          </div>

          {/* CTAs — pick an app */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={handleEnter} className="lp-cta" style={{
              padding: '15px 38px', borderRadius: 100,
              background: 'linear-gradient(135deg, #3f62ff 0%, #a78bfa 100%)',
              border: 'none', color: '#fff',
              cursor: 'pointer', fontSize: '1rem', fontWeight: 700,
              letterSpacing: '0.02em',
              boxShadow: '0 0 32px rgba(63,98,255,0.42), 0 0 64px rgba(63,98,255,0.14)',
              animation: 'lp-pulse 3.5s ease-in-out infinite',
            }}>
              🎬 Video → Docs
            </button>

            <button onClick={handleDocChat} className="lp-cta-g" style={{
              padding: '15px 38px', borderRadius: 100,
              background: 'linear-gradient(135deg, #10b981 0%, #22d3ee 100%)',
              border: 'none', color: '#06231c',
              cursor: 'pointer', fontSize: '1rem', fontWeight: 700,
              letterSpacing: '0.02em',
              boxShadow: '0 0 32px rgba(52,211,153,0.35)',
              animation: 'lp-pulse-green 3.5s ease-in-out infinite',
            }}>
              💬 Doc → Chat
            </button>

            <button
              onClick={() => document.getElementById('lp-how')?.scrollIntoView({ behavior: 'smooth' })}
              className="lp-ghost"
              style={{
                padding: '15px 32px', borderRadius: 100,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.62)',
                cursor: 'pointer', fontSize: '1rem', fontWeight: 500,
              }}>
              See how it works ↓
            </button>
          </div>

          {/* Stats row */}
          <div style={{
            display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center',
            marginTop: 52, marginBottom: 56,
          }}>
            {[
              { value: '0 bytes', label: 'sent to any server', color: '#3f62ff' },
              { value: '~96%',    label: 'transcript accuracy (Whisper Small)', color: '#a78bfa' },
              { value: 'Offline', label: 'after a one-time model download', color: '#06b6d4' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 800,
                  color: s.color, letterSpacing: '-0.02em',
                  textShadow: `0 0 30px ${s.color}55`,
                }}>{s.value}</div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.38)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

        </section>

        {/* ── Before / After ──────────────────────────────────── */}
        <section style={{ padding: '0 24px 80px', maxWidth: 860, margin: '0 auto' }}>
          <h2 style={{
            textAlign: 'center', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
            fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 12,
          }}>
            Raw video{' '}
            <span style={{ background: 'linear-gradient(90deg, #3f62ff, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              vs
            </span>
            {' '}VideoDoc output
          </h2>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.95rem', marginBottom: 28 }}>
            Drag the slider to compare. This is the actual transformation.
          </p>
          <BeforeAfter />
        </section>

        {/* ── How it actually happens (live demo) ─────────────── */}
        <section style={{
          padding: '0 24px 80px', maxWidth: 760, margin: '0 auto',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
            How it actually happens
          </div>
          <ProductDemo />
        </section>

        {/* ── Story beat ──────────────────────────────────────── */}
        <section style={{ padding: '0 24px 80px', maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            padding: '32px 40px',
            borderRadius: 18,
            background: 'rgba(63,98,255,0.06)',
            border: '1px solid rgba(63,98,255,0.15)',
            backdropFilter: 'blur(12px)',
          }}>
            <p style={{
              fontSize: 'clamp(1rem, 2.2vw, 1.25rem)',
              color: 'rgba(255,255,255,0.7)',
              lineHeight: 1.8,
              margin: 0,
              fontStyle: 'italic',
              fontWeight: 300,
            }}>
              "Documentation is the one thing everyone agrees must be done, and the first thing no one actually wants to do.
              Training done. Process notes pending. Motivation missing.
              VideoDoc gets it done before you even think twice."
            </p>
          </div>
        </section>

        {/* ── Who it's for ────────────────────────────────────── */}
        <section className="lp-section" style={{ padding: '60px 24px 100px', maxWidth: 1080, margin: '0 auto' }}>
          <h2 style={{
            textAlign: 'center',
            fontSize: 'clamp(2rem, 5vw, 3.4rem)',
            fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 14,
          }}>
            Made for anyone who{' '}
            <span style={{
              background: 'linear-gradient(90deg, #7b96ff, #a78bfa)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              records to explain
            </span>
          </h2>
          <p style={{
            textAlign: 'center', color: 'rgba(255,255,255,0.45)',
            fontSize: '1.05rem', marginBottom: 52,
          }}>
            If you've ever recorded something and thought "I should write this up",
            VideoDoc is for you.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 18,
          }}>
            {PERSONAS.map((p, i) => (
              <div key={i} className="lp-card" style={{
                padding: '28px 24px', borderRadius: 16,
                background: 'rgba(28,18,55,0.65)',
                border: '1px solid rgba(255,255,255,0.07)',
                backdropFilter: 'blur(16px)',
                cursor: 'default',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
              }}>
                <div style={{ fontSize: 32, marginBottom: 14 }}>{p.icon}</div>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: p.color, marginBottom: 8,
                }}>
                  {p.role}
                </div>
                <p style={{
                  fontSize: '0.975rem', fontWeight: 600,
                  color: 'rgba(255,255,255,0.88)', lineHeight: 1.4, marginBottom: 10,
                }}>
                  {p.hook}
                </p>
                <p style={{
                  fontSize: '0.85rem', color: 'rgba(255,255,255,0.48)',
                  lineHeight: 1.65, margin: 0,
                }}>
                  {p.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────── */}
        <section className="lp-section" style={{ padding: '100px 24px', maxWidth: 1080, margin: '0 auto' }}>
          <h2 style={{
            textAlign: 'center',
            fontSize: 'clamp(2rem, 5vw, 3.4rem)',
            fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 14,
          }}>
            The tools that make it{' '}
            <span style={{
              background: 'linear-gradient(90deg, #7b96ff, #a78bfa)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              actually happen
            </span>
          </h2>
          <p style={{
            textAlign: 'center', color: 'rgba(255,255,255,0.45)',
            fontSize: '1.05rem', marginBottom: 56,
          }}>
            A complete pipeline that runs in your browser, no installs, no cloud, no compromises on privacy.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 18,
          }}>
            {FEATURES.map((f, i) => (
              <div key={i} className="lp-card" style={{
                padding: '28px 22px', borderRadius: 16,
                background: 'rgba(28,18,55,0.65)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(16px)',
                cursor: 'default',
                animation: `lp-float ${7.5 + i * 0.9}s ease-in-out infinite`,
                animationDelay: `${i * 0.55}s`,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
              }}>
                <div style={{ fontSize: 34, marginBottom: 16, filter: `drop-shadow(0 0 9px ${f.color})` }}>
                  {f.icon}
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: f.color, marginBottom: 10,
                }}>
                  {f.title}
                </div>
                <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, margin: 0 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Talk to your documentation (RAG) ────────────────── */}
        <section className="lp-section" style={{ padding: '90px 24px', maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#34d399', marginBottom: 12 }}>
              New · Vid Chat
            </div>
            <h2 style={{ fontSize: 'clamp(1.9rem, 4.5vw, 3rem)', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 14 }}>
              Don't just read it.{' '}
              <span style={{ background: 'linear-gradient(90deg, #34d399, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Vid Chat it.</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.05rem', maxWidth: 640, margin: '0 auto', lineHeight: 1.7 }}>
              Once your guide is built, ask it anything. It finds the exact step, answers in plain language, and shows you the matching frame with a jump-to-moment link. Embeddings and retrieval run entirely in your browser, no server, no API keys. And if something is not in your document, it tells you honestly, then offers the AI model's own knowledge or a real web search with sources.
            </p>
          </div>
          <DocChatDemo />
        </section>

        {/* ── How it works ────────────────────────────────────── */}
        <section id="lp-how" className="lp-section" style={{ padding: '100px 24px', maxWidth: 880, margin: '0 auto' }}>
          <h2 style={{
            textAlign: 'center',
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 14,
          }}>
            From raw footage to{' '}
            <span style={{
              background: 'linear-gradient(90deg, #3f62ff, #06b6d4)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              published docs
            </span>
          </h2>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', marginBottom: 60 }}>
            VideoDoc handles the transcription, the structure, and the formatting. You focus on the content, then ask Vid Chat anything about the recording.
          </p>

          <div style={{ position: 'relative' }}>
            <div className="lp-steps-line" style={{
              position: 'absolute', top: 34, left: '10%', right: '10%', height: 1,
              background: 'linear-gradient(90deg, transparent, #3f62ff55, #a78bfa55, #06b6d455, transparent)',
              pointerEvents: 'none',
            }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16 }}>
              {STEPS.map((s, i) => (
                <div key={i} style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', textAlign: 'center', gap: 10,
                  animation: `lp-float ${8 + i}s ease-in-out infinite`,
                  animationDelay: `${i * 0.7}s`,
                }}>
                  <div style={{
                    width: 68, height: 68, borderRadius: '50%',
                    background: `radial-gradient(circle, ${s.color}1c 0%, ${s.color}07 70%)`,
                    border: `2px solid ${s.color}45`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, position: 'relative', zIndex: 1,
                    boxShadow: `0 0 22px ${s.color}2e`,
                  }}>
                    {s.icon}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: s.color, opacity: 0.6 }}>
                    {s.num}
                  </span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgba(255,255,255,0.82)', lineHeight: 1.3 }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it exactly works ────────────────────────────── */}
        <section className="lp-section" style={{ padding: '80px 24px 100px', maxWidth: 1140, margin: '0 auto' }}>
          <h2 style={{
            textAlign: 'center', fontSize: 'clamp(2rem, 5vw, 3.2rem)',
            fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 14,
          }}>
            How it{' '}
            <span style={{ background: 'linear-gradient(90deg, #3f62ff, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              exactly
            </span>
            {' '}works
          </h2>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: '1.05rem', marginBottom: 60 }}>
            Full transparency on every step. Where your data goes, how it's processed, what to expect.
          </p>

          {/* ── Main pipeline row ── */}
          <div style={{ position: 'relative' }}>
            {/* Connecting line */}
            <div style={{
              position: 'absolute', top: 33, left: '12%', right: '12%', height: 1,
              background: 'linear-gradient(90deg, #3f62ff55, #a78bfa55, #06b6d455, #fbbf2455)',
              pointerEvents: 'none',
            }} />

            <div className="lp-pipe-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
              {[
                {
                  icon: '🎬', color: '#3f62ff', num: '01', title: 'Upload Video',
                  desc: 'Loaded into browser memory. Stays on your device.',
                  chips: [{ label: '0 bytes sent', c: '#3f62ff' }, { label: 'Browser only', c: '#06b6d4' }],
                },
                {
                  icon: '👁', color: '#22d3ee', num: '02', title: 'Extract + See Screen',
                  desc: 'Frames and audio pulled out, then the AI reads the screen with Vision or OCR, naming exact elements and detecting the tools you used.',
                  chips: [{ label: 'Vision / OCR', c: '#22d3ee' }, { label: 'Tools detected', c: '#a78bfa' }],
                },
                {
                  icon: '🎧', color: '#06b6d4', num: '03', title: 'Transcribe + Chunk',
                  desc: 'Whisper Small runs in a Web Worker. Long transcripts are grouped into windows for fast, coherent passes.',
                  chips: [{ label: '~96% accuracy', c: '#06b6d4' }, { label: 'Long-video ready', c: '#3f62ff' }],
                },
                {
                  icon: '🚀', color: '#fbbf24', num: '04', title: 'Export',
                  desc: 'A full Desktop Procedure: HTML with sharp WebM step clips, plus clean PDF and DOCX, all generated locally.',
                  chips: [{ label: 'Step clips', c: '#fbbf24' }, { label: 'PDF / DOCX', c: '#a78bfa' }],
                },
                {
                  icon: '💬', color: '#34d399', num: '05', title: 'Vid Chat',
                  desc: 'Ask your recording anything. In-browser RAG finds the right step and answers with the matching frame.',
                  chips: [{ label: 'RAG chat', c: '#34d399' }, { label: 'Cites the step', c: '#22d3ee' }],
                },
              ].map((node, i) => (
                <div key={i} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  textAlign: 'center', gap: 8,
                }}>
                  {/* Circle icon */}
                  <div style={{
                    width: 66, height: 66, borderRadius: '50%', flexShrink: 0,
                    background: `radial-gradient(circle, ${node.color}1c 0%, ${node.color}07 70%)`,
                    border: `2px solid ${node.color}45`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, zIndex: 1, position: 'relative',
                    boxShadow: `0 0 20px ${node.color}28`,
                  }}>
                    {node.icon}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: node.color, opacity: 0.6 }}>
                    {node.num}
                  </span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>
                    {node.title}
                  </span>
                  <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.55, margin: 0 }}>
                    {node.desc}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
                    {node.chips.map((chip, ci) => (
                      <span key={ci} style={{
                        padding: '3px 9px', borderRadius: 100, fontSize: 10, fontWeight: 600,
                        background: `${chip.c}18`, border: `1px solid ${chip.c}40`, color: chip.c,
                      }}>{chip.label}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── AI fork ── */}
          <div style={{ marginTop: 24, position: 'relative' }}>
            {/* Connector line down from step 3 */}
            <div style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: 1, height: 28,
              background: 'linear-gradient(180deg, rgba(63,98,255,0.5), transparent)',
            }} />
            <div style={{
              textAlign: 'center', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)', paddingTop: 30, marginBottom: 16,
            }}>
              AI Annotation, auto-detected
            </div>

            <div className="lp-fork-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

              {/* Ollama */}
              <div style={{
                padding: '24px 22px', borderRadius: 16,
                background: 'rgba(63,98,255,0.07)',
                border: '1px solid rgba(63,98,255,0.25)',
                backdropFilter: 'blur(14px)',
                position: 'relative',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#22c55e',
                    boxShadow: '0 0 8px #22c55e',
                  }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Ollama detected</span>
                  <span style={{
                    marginLeft: 'auto', fontSize: 10, padding: '2px 8px', borderRadius: 100,
                    background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
                    color: '#86efac', letterSpacing: '0.05em',
                  }}>RECOMMENDED</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 16 }}>
                  VideoDoc pings <code style={{ fontSize: 11, background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4 }}>localhost:11434</code> at startup.
                  If Ollama is running, it auto-lists your installed models.
                  Best results with a vision model like gemma3, so the AI can see the screen.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Output quality', val: 92, color: '#3f62ff' },
                    { label: 'Privacy',         val: 100, color: '#22c55e' },
                    { label: 'Speed',           val: 70, color: '#fbbf24', note: 'depends on your GPU' },
                  ].map((bar, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{bar.label}</span>
                        <span style={{ fontSize: 11, color: bar.color }}>{bar.note ?? `${bar.val}%`}</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ width: `${bar.val}%`, height: '100%', background: bar.color, borderRadius: 2 }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
                  {['Fully private', 'Best quality', 'Any Ollama model'].map((t, i) => (
                    <span key={i} style={{
                      padding: '3px 10px', borderRadius: 100, fontSize: 10, fontWeight: 600,
                      background: 'rgba(63,98,255,0.15)', border: '1px solid rgba(63,98,255,0.3)',
                      color: '#7b96ff',
                    }}>{t}</span>
                  ))}
                </div>
              </div>

              {/* WebLLM */}
              <div style={{
                padding: '24px 22px', borderRadius: 16,
                background: 'rgba(167,139,250,0.07)',
                border: '1px solid rgba(167,139,250,0.2)',
                backdropFilter: 'blur(14px)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#a78bfa',
                    boxShadow: '0 0 8px #a78bfa',
                  }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>WebLLM fallback</span>
                  <span style={{
                    marginLeft: 'auto', fontSize: 10, padding: '2px 8px', borderRadius: 100,
                    background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
                    color: '#c4b5fd', letterSpacing: '0.05em',
                  }}>NO INSTALL</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 14 }}>
                  No Ollama? VideoDoc runs the model right in your browser via WebGPU, including a Vision model that reads the screen. You pick the model yourself, with accuracy and speed shown up front, so nothing changes behind your back. Needs a WebGPU browser (Chrome 113+).
                </p>
                {/* In-browser model picker — user chooses speed vs accuracy */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
                  {[
                    { label: 'Fast · 1B',     size: '~0.9 GB', acc: 'Good',   eta: '10 to 30s' },
                    { label: 'Balanced · 3B', size: '~2.2 GB', acc: 'Strong', eta: '30s to 1m', tag: 'Default' },
                    { label: 'Max · 7B',      size: '~5.5 GB', acc: 'Best',   eta: '1 to 3m' },
                    { label: 'Vision · 4.2B', size: '~3.5 GB', acc: 'Sees screen', eta: '1 to 3m', tag: 'New' },
                  ].map((m, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(167,139,250,0.18)' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{m.label}</span>
                      {m.tag && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 100, background: 'rgba(34,197,94,0.18)', color: '#86efac' }}>{m.tag}</span>}
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{m.size} · {m.acc} · {m.eta}/segment</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Output quality', val: 82, color: '#a78bfa', note: 'you pick' },
                    { label: 'Privacy',         val: 100, color: '#22c55e' },
                    { label: 'Speed',           val: 55, color: '#fbbf24', note: 'depends on your GPU' },
                  ].map((bar, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{bar.label}</span>
                        <span style={{ fontSize: 11, color: bar.color }}>{bar.note ?? `${bar.val}%`}</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ width: `${bar.val}%`, height: '100%', background: bar.color, borderRadius: 2 }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
                  {['Zero install', 'Pick your model', 'Still private', 'Needs Chrome 113+'].map((t, i) => (
                    <span key={i} style={{
                      padding: '3px 10px', borderRadius: 100, fontSize: 10, fontWeight: 600,
                      background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
                      color: '#c4b5fd',
                    }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Export formats row */}
            <div style={{ marginTop: 24 }}>
              <div style={{
                textAlign: 'center', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.35)', marginBottom: 16,
              }}>
                Export, pick your format
              </div>
              <div className="lp-export-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {[
                  {
                    icon: '🌐', label: 'HTML Guide', color: '#06b6d4',
                    features: ['Index, steps, FAQ & flow', 'Sharp WebM step clips', 'Scroll progress bar', 'Printable + shareable'],
                  },
                  {
                    icon: '📄', label: 'PDF', color: '#a78bfa',
                    features: ['Clean print layout', 'Embedded screenshots', 'Works in any reader', 'Offline-ready'],
                  },
                  {
                    icon: '📝', label: 'DOCX', color: '#fbbf24',
                    features: ['Word compatible', 'Paste into Notion', 'Confluence ready', 'Fully editable'],
                  },
                ].map((fmt, i) => (
                  <div key={i} style={{
                    padding: '18px 16px', borderRadius: 12,
                    background: 'rgba(28,18,55,0.65)',
                    border: `1px solid ${fmt.color}20`,
                    backdropFilter: 'blur(12px)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 20, filter: `drop-shadow(0 0 5px ${fmt.color})` }}>{fmt.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: fmt.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{fmt.label}</span>
                    </div>
                    {fmt.features.map((f, fi) => (
                      <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: fmt.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>{f}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── First-run downloads ──────────────────────────────── */}
        <section className="lp-section" style={{ padding: '70px 24px 90px', maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7b96ff', marginBottom: 12 }}>
              One-time setup
            </div>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4.2vw, 2.8rem)', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 14 }}>
              What downloads the{' '}
              <span style={{ background: 'linear-gradient(90deg, #3f62ff, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>first time</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.02rem', maxWidth: 660, margin: '0 auto', lineHeight: 1.7 }}>
              Because everything runs on your machine instead of a server, the AI models download once on first use, then stay cached in your browser. Every run after that is instant and fully offline.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {[
              { icon: '🎙', name: 'Whisper Small (speech to text)', size: '~970 MB', when: 'On your first video. The more accurate model that nails names and jargon.', color: '#06b6d4' },
              { icon: '🧠', name: 'WebLLM (writes the steps)', size: '~2.2 to 5.5 GB', when: 'First annotation in browser mode. Pick Balanced (Qwen2.5-3B, default), Quality (Phi-3.5) or Max (Qwen2.5-7B)', color: '#a78bfa' },
              { icon: '👁', name: 'Vision model (optional)', size: '~3.5 GB', when: 'Browser Vision mode, where the AI sees the screen (Phi-3.5-Vision). With Ollama, gemma3 does this, no download.', color: '#7b96ff' },
              { icon: '💬', name: 'Embeddings (doc chat)', size: '~90 MB', when: 'First time you ask your documentation a question', color: '#34d399' },
              { icon: '🔤', name: 'OCR (reads the screen)', size: '~12 MB', when: 'Reads on-screen text from frames (used when not in Vision mode)', color: '#22d3ee' },
            ].map((m, i) => (
              <div key={i} style={{ borderRadius: 16, padding: '24px 22px', background: 'rgba(28,18,55,0.6)', border: `1px solid ${m.color}30`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 30, marginBottom: 12, filter: `drop-shadow(0 0 8px ${m.color})` }}>{m.icon}</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 6 }}>{m.name}</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: m.color, letterSpacing: '-0.02em', marginBottom: 8 }}>{m.size}</div>
                <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.55, margin: 0 }}>{m.when}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 22, display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {['Downloaded once', 'Cached in your browser', 'Instant after first run', 'Skip WebLLM with Ollama'].map((t, i) => (
              <span key={i} style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', padding: '6px 14px', borderRadius: 100, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>✓ {t}</span>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.82rem', color: 'rgba(255,255,255,0.38)', marginTop: 18, maxWidth: 680, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
            Tip: tech users can run Ollama instead of WebLLM. It skips the large browser download, runs Vision natively with gemma3, and gives the strongest results.
          </p>
        </section>

        {/* ── V1 → V2 → V3 progression ─────────────────────────── */}
        <section className="lp-section" style={{ padding: '90px 24px', maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#fbbf24', marginBottom: 12 }}>
              How far it's come
            </div>
            <h2 style={{ fontSize: 'clamp(1.9rem, 4.5vw, 3rem)', fontWeight: 700, letterSpacing: '-0.025em' }}>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>v1</span>{' → '}
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>v2</span>{' → '}
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>v3</span>{' → '}
              <span style={{ background: 'linear-gradient(90deg, #3f62ff, #22d3ee, #a78bfa, #3f62ff)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'lp-shimmer 4s linear infinite' }}>v4</span>
            </h2>
          </div>

          <div className="lp-v-split" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
            {/* V1 */}
            <div style={{ borderRadius: 18, padding: '24px 22px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.32)', marginBottom: 16 }}>v1 · the basics</div>
              {[
                ['📝', 'Transcribe + frame every few seconds'],
                ['🔁', 'One LLM call per tiny segment'],
                ['🖼', 'A few static screenshots per step'],
                ['🏷', 'Title = the video file name'],
                ['📄', 'Read the doc, that\'s it'],
                ['🎧', 'Audio-only understanding'],
              ].map(([ic, t], i) => (
                <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '7px 0', fontSize: '0.86rem', color: 'rgba(255,255,255,0.42)' }}>
                  <span style={{ flexShrink: 0, opacity: 0.55 }}>{ic}</span>{t}
                </div>
              ))}
            </div>

            {/* V2 */}
            <div style={{ borderRadius: 18, padding: '24px 22px', background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 16 }}>v2 · then</div>
              {[
                ['🧩', 'Smart chunking for long videos'],
                ['👁', 'OCR reads the on-screen text'],
                ['🎞', 'Animated step GIFs'],
                ['💬', 'RAG chat with your docs'],
                ['🧠', 'Llama 3.2 3B browser model'],
                ['🎧', 'Audio-only understanding'],
              ].map(([ic, t], i) => (
                <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '7px 0', fontSize: '0.86rem', color: 'rgba(255,255,255,0.62)' }}>
                  <span style={{ flexShrink: 0, opacity: 0.7 }}>{ic}</span>{t}
                </div>
              ))}
            </div>

            {/* V3 */}
            <div style={{ borderRadius: 18, padding: '24px 22px', background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.13)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>v3 · then</div>
              {[
                ['👁', 'It sees the screen, not just OCR text'],
                ['🎙', 'A far sharper transcript with Whisper Small'],
                ['📋', 'A real Desktop Procedure (Index, Purpose, FAQ, flow)'],
                ['🎬', 'Crisp WebM step clips, sharper than GIFs'],
                ['❓', 'RAG-grounded FAQ and a clean phased flow'],
                ['🧭', 'Steps name the app, ribbon and tab'],
              ].map(([ic, t], i) => (
                <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '7px 0', fontSize: '0.86rem', color: 'rgba(255,255,255,0.72)' }}>
                  <span style={{ flexShrink: 0, opacity: 0.8 }}>{ic}</span>{t}
                </div>
              ))}
            </div>

            {/* V4 */}
            <div className="lp-card" style={{ position: 'relative', borderRadius: 18, padding: '24px 22px', background: 'linear-gradient(160deg, rgba(63,98,255,0.14), rgba(167,139,250,0.07))', border: '1px solid rgba(63,98,255,0.42)', animation: 'lp-pulse 4s ease-in-out infinite' }}>
              <div style={{ position: 'absolute', top: -11, right: 16, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fff', background: 'linear-gradient(135deg, #3f62ff, #a78bfa)', padding: '4px 11px', borderRadius: 100, animation: 'lp-badge-glow 2.6s ease-in-out infinite' }}>The trust release</div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9db0ff', marginBottom: 16 }}>v4 · now</div>
              {[
                ['🔍', 'Looks at the screen first, then writes'],
                ['🎯', 'A new step exactly where the screen changed'],
                ['🛡', 'Nothing made up: no invented steps, names or conclusions'],
                ['✍️', 'Fix, reorder or delete steps before you share'],
                ['⏱', 'Tells you how long it will take, shows steps as it works'],
                ['💻', 'Use it on the web, or fully offline at the office'],
              ].map(([ic, t], i) => (
                <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '7px 0', fontSize: '0.86rem', color: 'rgba(255,255,255,0.88)' }}>
                  <span style={{ flexShrink: 0 }}>{ic}</span>{t}
                </div>
              ))}
            </div>
          </div>

          <p style={{ textAlign: 'center', maxWidth: 760, margin: '32px auto 0', fontSize: '1.06rem', lineHeight: 1.75, color: 'rgba(255,255,255,0.64)' }}>
            <span style={{ background: 'linear-gradient(90deg,#7b96ff,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>Why v4 matters:</span>{' '}
            v3 taught it to <em>see and hear like a person</em>. v4 makes it <em>honest</em>: everything it writes is checked against what was really said and shown on screen, so you can share the document <em>without rewatching the video yourself.</em>
          </p>
        </section>

        {/* ── What's next in v5 (coming soon) ──────────────────── */}
        <section className="lp-section" style={{ padding: '40px 24px 90px', maxWidth: 940, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7b96ff', marginBottom: 12 }}>
              The road ahead
            </div>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4.2vw, 2.8rem)', fontWeight: 700, letterSpacing: '-0.025em' }}>
              What's next in{' '}
              <span style={{ background: 'linear-gradient(90deg, #3f62ff, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>v5</span>
              <span style={{ marginLeft: 12, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fff', background: 'rgba(123,150,255,0.22)', border: '1px solid rgba(123,150,255,0.45)', padding: '4px 12px', borderRadius: 100, verticalAlign: 'middle', whiteSpace: 'nowrap', animation: 'lp-badge-glow 2.6s ease-in-out infinite' }}>Coming soon</span>
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {[
              ['Smart screenshots', 'Every image zooms in on the exact spot that was clicked, so the reader sees precisely where to act.'],
              ['Multi-window awareness', 'Open a second app mid-recording? The steps follow along without mixing the two screens up.'],
              ['Sharper vision', 'Reads tiny text, dense tables and crowded toolbars more reliably.'],
              ['Better with accents', 'Understands accented and technical speech better by learning the words it can see on screen.'],
              ['Meeting Minutes mode', 'Who said what, and who led the session.'],
              ['More languages', 'Recordings in languages other than English.'],
              ['Custom branding', 'Your logo and colours, applied as a clean document theme.'],
              ['Measured accuracy', 'Every update is tested against real recordings before release, so quality only moves up.'],
            ].map(([title, desc], i) => (
              <div key={i} style={{ borderRadius: 16, padding: '22px 20px', background: 'rgba(255,255,255,0.025)', border: '1px dashed rgba(123,150,255,0.35)' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 8 }}>{title}</div>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Final CTA ───────────────────────────────────────── */}
        <section className="lp-section" style={{ padding: '100px 24px 130px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%', width: 700, height: 700,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(63,98,255,0.07) 0%, transparent 70%)',
            transform: 'translate(-50%, -50%)', filter: 'blur(50px)', pointerEvents: 'none',
          }} />

          <h2 style={{
            fontSize: 'clamp(2.4rem, 6vw, 4.2rem)',
            fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 18, lineHeight: 1.1,
          }}>
            Your next recording is already a doc.
          </h2>
          <p style={{
            color: 'rgba(255,255,255,0.45)', fontSize: '1.05rem',
            maxWidth: 480, margin: '0 auto 50px', lineHeight: 1.75,
          }}>
            VideoDoc is free, open, and runs entirely in your browser.
            No account. No cloud. No more putting it off.
          </p>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={handleEnter} className="lp-cta" style={{
              padding: '18px 48px', borderRadius: 100,
              background: 'linear-gradient(135deg, #3f62ff, #a78bfa)',
              border: 'none', color: '#fff',
              cursor: 'pointer', fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.03em',
              boxShadow: '0 0 44px rgba(63,98,255,0.45), 0 0 88px rgba(63,98,255,0.16)',
              animation: 'lp-pulse 3.5s ease-in-out infinite',
            }}>
              🎬 Video → Docs
            </button>
            <button onClick={handleDocChat} className="lp-cta-g" style={{
              padding: '18px 48px', borderRadius: 100,
              background: 'linear-gradient(135deg, #10b981, #22d3ee)',
              border: 'none', color: '#06231c',
              cursor: 'pointer', fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.03em',
              boxShadow: '0 0 44px rgba(52,211,153,0.35)',
              animation: 'lp-pulse-green 3.5s ease-in-out infinite',
            }}>
              💬 Doc → Chat
            </button>
          </div>

          <p style={{ marginTop: 26, fontSize: '0.78rem', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.06em' }}>
            No sign-up · No API key · Works in Chrome and Edge
          </p>
        </section>

        {/* ── Footer ──────────────────────────────────────────── */}
        <footer className="lp-footer" style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '28px 40px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          color: 'rgba(255,255,255,0.25)', fontSize: '0.82rem',
          flexWrap: 'wrap', gap: 8,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            With{' '}
            <span style={{
              color: '#3f62ff',
              textShadow: '0 0 8px rgba(63,98,255,0.9), 0 0 20px rgba(63,98,255,0.5)',
              fontSize: '1.1rem',
            }}>♥</span>
            {' '}from VideoDoc
          </span>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>Made for anyone who records to explain.</span>
        </footer>
      </div>
    </>
  )
}
