function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Convert LLM markdown output to safe HTML
function mdToHtml(text) {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[\*\-]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\.\s+(.+)$/gm, '<li>$2</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/<\/ul>\s*<ul>/g, '')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(.+)$/, '<p>$1</p>')
}

// Parse STEPS: / RESULT: format
function parseSteps(text) {
  if (!text) return null
  const stepsMatch = text.match(/STEPS?:\s*([\s\S]*?)(?=RESULT:|$)/i)
  const resultMatch = text.match(/RESULT:\s*([\s\S]*)$/i)
  if (!stepsMatch) return null
  const steps = stepsMatch[1]
    .split('\n')
    .map(l => l.replace(/^[\d\-\*•]+[\.\):\s]+/, '').trim())
    .filter(l => l.length > 3)
  const result = resultMatch?.[1]?.trim() ?? null
  return steps.length > 0 ? { steps, result } : null
}

// Get neighboring frames from the full frames array around a timestamp
function getClipFrames(allFrames, centerTs, windowSecs = 15) {
  if (!allFrames?.length) return []
  return allFrames
    .filter(f => Math.abs(f.timestamp - centerTs) <= windowSecs)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(f => f.imageData)
    .filter(Boolean)
}

function buildAnnotationBlock(doc) {
  // Custom sections from reference doc
  if (doc.sectionedAnnotation) {
    const colors = ['#1e7b6a', '#b8932a', '#5b3fa8', '#c94b2a', '#1a6bbf']
    return Object.entries(doc.sectionedAnnotation).map(([sec, content], i) => `
      <div class="ann-block" style="border-left-color:${colors[i % colors.length]}">
        <div class="ann-label" style="color:${colors[i % colors.length]}">${esc(sec)}</div>
        <div class="ann-body">${mdToHtml(content)}</div>
      </div>`).join('')
  }

  if (!doc.annotation) return ''

  // Try STEPS: / RESULT: format (default prompt)
  const parsed = parseSteps(doc.annotation)
  if (parsed) {
    const stepItems = parsed.steps.map((s, i) => `
      <div class="step-row">
        <div class="step-badge">${i + 1}</div>
        <p class="step-text">${esc(s)}</p>
      </div>`).join('')
    const resultBlock = parsed.result ? `
      <div class="result-row">
        <div class="result-icon">✓</div>
        <p class="result-text">${esc(parsed.result)}</p>
      </div>` : ''
    return `
      <div class="steps-block">
        <div class="steps-header">How to do this</div>
        ${stepItems}
        ${resultBlock}
      </div>`
  }

  // Fallback: plain text
  return `
    <div class="ann-block" style="border-left-color:#b8932a">
      <div class="ann-label" style="color:#b8932a">✦ AI Insight</div>
      <div class="ann-body">${mdToHtml(doc.annotation)}</div>
    </div>`
}

// Caption text from transcript (first ~60 chars cleaned)
function captionFromTranscript(text) {
  return text.trim().slice(0, 65).replace(/\s+\S*$/, '') + (text.length > 65 ? '…' : '')
}

export function exportHTML(docs, videoName, allFrames, meta = {}) {
  // Prefer the user-given title; only fall back to a generic heading (never the video file name).
  const title = (meta.title && meta.title.trim()) || 'Step-by-Step Guide'
  const tools = meta.tools || []
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const annotated = docs.filter(d => d.annotation).length
  const total = docs.length
  const lastTs = docs[docs.length - 1]?.endTimestamp ?? docs[docs.length - 1]?.timestamp ?? 0
  const durStr = `${Math.floor(lastTs / 60)}m ${Math.floor(lastTs % 60)}s`

  // Timeline (process steps)
  const timelineItems = docs.map((doc, i) => {
    const sections = doc.sectionedAnnotation || parseDefaultSections(doc.annotation)
    const heading = sections
      ? Object.values(sections)[0]?.split(/[.!?]/)[0]?.trim()
      : doc.annotation?.split(/[.!?]/)[0]?.trim() || doc.text.slice(0, 60).trim()
    return `
    <div class="tl-step reveal" style="transition-delay:${Math.min(i * 0.04, 0.4)}s">
      <div class="tl-dot">${i + 1}</div>
      <div class="tl-content">
        <span class="tl-time">${esc(doc.label)}</span>
        <h3>${esc(heading ?? doc.text.slice(0, 60))}…</h3>
        <p class="tl-caption">${esc(doc.text.slice(0, 120))}${doc.text.length > 120 ? '…' : ''}</p>
      </div>
    </div>`
  }).join('\n')

  const gifs = meta.gifs instanceof Map ? meta.gifs : new Map()

  // Segment entries — large side-by-side layout
  const segEntries = docs.map((doc, i) => {
    const clipFrames = getClipFrames(allFrames, doc.timestamp, 15)
    const annotBlock = buildAnnotationBlock(doc)
    const caption = captionFromTranscript(doc.text)
    const gif = gifs.get(doc.timestamp)

    // Prefer the smooth animated GIF (±3s clip); fall back to frame slideshow.
    const mediaHtml = gif
      ? `<figure class="seg-media"><img src="${gif}" alt="${esc(doc.label)}" style="width:100%;height:auto;display:block;max-height:420px;object-fit:contain;border-radius:8px">${caption ? `<figcaption class="seg-caption">${esc(caption)}</figcaption>` : ''}</figure>`
      : clipFrames.length > 1
        ? buildAnimatedMedia(clipFrames, i, caption)
        : clipFrames.length === 1
          ? buildStaticMedia(clipFrames[0], doc.label, caption)
          : `<div class="seg-no-frame"><span>${esc(doc.label)}</span></div>`

    return `
    <div class="seg-entry reveal" style="transition-delay:0.05s">
      <div class="seg-step-header">
        <span class="step-num">Step ${i + 1}</span>
        <span class="step-ts">${esc(doc.label)}</span>
      </div>
      <div class="seg-body">
        <div class="seg-media-col">
          ${mediaHtml}
        </div>
        <div class="seg-content-col">
          <p class="seg-transcript">"${esc(doc.text)}"</p>
          <div class="ann-blocks">
            ${annotBlock || '<p class="no-ann">No annotation generated</p>'}
          </div>
        </div>
      </div>
    </div>`
  }).join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
<style>
:root{
  --paper:#faf8f4;--paper2:#f2ede6;--paper3:#e8e2d9;
  --ink:#1a1814;--ink2:#4a4740;--ink3:#88837c;
  --gold:#b8932a;--gold-light:#f5e9cc;--gold-dark:#7a6018;
  --teal:#1e7b6a;--teal-light:#d0ede8;--teal-dark:#104d42;
  --border:rgba(26,24,20,.10);--border2:rgba(26,24,20,.18);
  --r:10px;--r-lg:16px;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'DM Sans',sans-serif;background:var(--paper);color:var(--ink);font-size:16px;line-height:1.7}

/* NAV */
nav{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(250,248,244,.94);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);padding:0 2rem}
.nav-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:60px}
.nav-logo{font-size:15px;font-weight:600;color:var(--ink);text-decoration:none;display:flex;align-items:center;gap:9px}
.nav-dot{width:8px;height:8px;border-radius:50%;background:var(--gold);display:inline-block}
.nav-links{display:flex;list-style:none}
.nav-links a{text-decoration:none;color:var(--ink2);font-size:13px;font-weight:500;padding:6px 14px;border-radius:6px;transition:background .15s,color .15s}
.nav-links a:hover{background:var(--paper3);color:var(--ink)}
.pbar{position:fixed;top:60px;left:0;right:0;height:2px;background:var(--border);z-index:99}
.pfill{height:100%;background:var(--gold);transition:width .1s linear;width:0%}

/* HERO */
.hero{padding:120px 2rem 80px;max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 340px;gap:60px;align-items:center}
.hero-tag{display:inline-block;background:var(--gold-light);color:var(--gold-dark);font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;padding:4px 12px;border-radius:20px;margin-bottom:18px}
.hero h1{font-size:42px;line-height:1.15;font-weight:700;margin-bottom:18px}
.hero-desc{font-size:15.5px;color:var(--ink2);line-height:1.8;max-width:500px}
.hero-stats{background:white;border:1px solid var(--border2);border-radius:var(--r-lg);padding:28px;display:grid;grid-template-columns:1fr 1fr;gap:20px}
.stat{text-align:center}
.stat-n{font-size:32px;font-weight:700;color:var(--ink);display:block;line-height:1}
.stat-l{font-size:11px;color:var(--ink3);letter-spacing:.06em;text-transform:uppercase;margin-top:6px;display:block}
.stat.gold .stat-n{color:var(--gold)}
.stat.teal .stat-n{color:var(--teal)}

/* SECTIONS */
section{max-width:1100px;margin:0 auto;padding:80px 2rem}
.section-label{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:12px}
h2{font-size:34px;font-weight:600;color:var(--ink);line-height:1.2;margin-bottom:28px}
hr.divider{border:none;border-top:1px solid var(--border);max-width:1100px;margin:0 auto}

/* TIMELINE */
.timeline{position:relative;padding-left:44px;margin-top:40px}
.timeline::before{content:'';position:absolute;left:9px;top:14px;bottom:14px;width:1px;background:var(--border2)}
.tl-step{position:relative;margin-bottom:32px}
.tl-dot{position:absolute;left:-44px;top:3px;width:20px;height:20px;border-radius:50%;background:white;border:2px solid var(--gold);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:var(--gold-dark)}
.tl-time{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;background:var(--gold-light);color:var(--gold-dark);padding:2px 9px;border-radius:12px;margin-bottom:5px}
.tl-content h3{font-size:14.5px;font-weight:600;color:var(--ink);margin-bottom:4px;line-height:1.4}
.tl-caption{font-size:13px;color:var(--ink3);line-height:1.6}

/* SEGMENT ENTRIES */
.seg-entry{background:white;border:1px solid var(--border2);border-radius:var(--r-lg);margin-bottom:32px;overflow:hidden;transition:box-shadow .2s}
.seg-entry:hover{box-shadow:0 8px 40px rgba(0,0,0,.08)}
.seg-step-header{display:flex;align-items:center;gap:12px;padding:14px 24px;background:var(--paper2);border-bottom:1px solid var(--border)}
.step-num{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--teal-dark);background:var(--teal-light);padding:3px 10px;border-radius:20px}
.step-ts{font-family:'DM Sans',monospace;font-size:13px;font-weight:700;color:var(--gold-dark);background:var(--gold-light);padding:3px 10px;border-radius:20px}
.seg-body{display:grid;grid-template-columns:1fr 1fr;min-height:320px}
.seg-media-col{position:relative;background:var(--paper3);overflow:hidden}
.seg-content-col{padding:24px 28px;display:flex;flex-direction:column;gap:16px;border-left:1px solid var(--border)}
.seg-no-frame{width:100%;height:100%;min-height:280px;display:flex;align-items:center;justify-content:center;background:var(--paper3);color:var(--ink3);font-size:12px;letter-spacing:.06em;text-transform:uppercase}

/* MEDIA (static + animated) */
.media-wrap{position:relative;width:100%;background:#111}
.media-wrap img{width:100%;height:auto;display:block;object-fit:contain;max-height:400px}
.media-caption{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.82));color:#faf8f4;padding:28px 14px 12px;font-size:12px;font-weight:500;line-height:1.4}

/* Animated frames */
.anim-wrap{position:relative;width:100%;background:#111;overflow:hidden}
.anim-frame{width:100%;height:auto;display:block;object-fit:contain;position:absolute;top:0;left:0;max-height:400px;opacity:0}

/* ANNOTATION BLOCKS */
.seg-transcript{font-size:14px;color:var(--ink2);line-height:1.75;font-style:italic;border-left:3px solid var(--border2);padding-left:12px}
.ann-blocks{display:flex;flex-direction:column;gap:10px;flex:1}
.ann-block{border-left:3px solid var(--teal);border-radius:0 8px 8px 0;padding:11px 14px;background:var(--paper2)}
.ann-label{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-bottom:5px;display:block}
.ann-body{font-size:13.5px;color:var(--ink);line-height:1.7}
.ann-body p{margin-bottom:6px}.ann-body p:last-child{margin-bottom:0}
.ann-body ul{padding-left:18px;margin:4px 0}.ann-body li{margin-bottom:3px}
.ann-body strong{font-weight:600}.ann-body em{font-style:italic}
.no-ann{font-size:13px;color:var(--ink3);font-style:italic}

/* STEPS BLOCK */
.steps-block{background:white;border:1px solid var(--border2);border-radius:var(--r-lg);overflow:hidden}
.steps-header{background:var(--teal-light);color:var(--teal-dark);font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:8px 14px;border-bottom:1px solid rgba(30,123,106,.2)}
.step-row{display:flex;align-items:flex-start;gap:12px;padding:10px 14px;border-bottom:1px solid var(--border)}
.step-row:last-of-type{border-bottom:none}
.step-badge{width:22px;height:22px;border-radius:50%;background:var(--teal);color:white;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.step-text{font-size:13.5px;color:var(--ink);line-height:1.55;flex:1}
.result-row{display:flex;align-items:flex-start;gap:12px;padding:10px 14px;background:var(--gold-light);border-top:1px solid rgba(184,147,42,.25)}
.result-icon{width:22px;height:22px;border-radius:50%;background:var(--gold);color:white;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.result-text{font-size:13px;color:var(--gold-dark);line-height:1.55;font-weight:500;flex:1}

/* FOOTER */
footer{background:var(--ink);color:#e8e4dc;text-align:center;padding:48px 2rem 40px;font-size:13px}
footer span{color:var(--gold)}
.footer-sub{font-size:13px;color:#a09a90;margin-top:10px}

/* REVEAL */
.reveal{opacity:0;transform:translateY(20px);transition:opacity .5s ease,transform .5s ease}
.reveal.visible{opacity:1;transform:translateY(0)}

/* RESPONSIVE */
@media(max-width:860px){
  .hero{grid-template-columns:1fr}
  .hero h1{font-size:32px}
  .nav-links{display:none}
  .seg-body{grid-template-columns:1fr}
  .seg-media-col{min-height:220px}
  .seg-content-col{border-left:none;border-top:1px solid var(--border)}
}
</style>
</head>
<body>

<div class="pbar"><div class="pfill" id="pfill"></div></div>

<nav>
  <div class="nav-inner">
    <a href="#top" class="nav-logo"><span class="nav-dot"></span>VideoDoc</a>
    <ul class="nav-links">
      <li><a href="#overview">Overview</a></li>
      <li><a href="#process">Process Steps</a></li>
      <li><a href="#steps">Documentation</a></li>
    </ul>
  </div>
</nav>

<div id="top">
  <div class="hero">
    <div>
      <div class="hero-tag">VideoDoc · AI-Generated Step-by-Step Documentation</div>
      <h1>${esc(title)}</h1>
      <p class="hero-desc">This document provides a step-by-step technical breakdown of every action performed in the recording. Each step documents exactly what was clicked or configured, the mechanism behind it, and the outcome — enabling any reader to understand or replicate the process without watching the video.</p>
      ${tools.length ? `<div style="margin-top:18px"><div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);margin-bottom:8px">Tools used (detected on screen)</div><div style="display:flex;flex-wrap:wrap;gap:8px">${tools.map(t => `<span style="font-size:12px;font-weight:600;background:var(--teal-light);color:var(--teal-dark);padding:4px 12px;border-radius:20px">${esc(t)}</span>`).join('')}</div></div>` : ''}
    </div>
    <div class="hero-stats">
      <div class="stat">
        <span class="stat-n">${total}</span>
        <span class="stat-l">Steps Documented</span>
      </div>
      <div class="stat teal">
        <span class="stat-n">${annotated}</span>
        <span class="stat-l">AI Annotated</span>
      </div>
      <div class="stat gold">
        <span class="stat-n">${durStr}</span>
        <span class="stat-l">Video Duration</span>
      </div>
      <div class="stat">
        <span class="stat-n">${new Date().toLocaleDateString('en-US',{day:'numeric',month:'short'})}</span>
        <span class="stat-l">${new Date().getFullYear()}</span>
      </div>
    </div>
  </div>
</div>

<hr class="divider">

<section id="process">
  <div class="reveal">
    <div class="section-label">Section 01 — Execution Flow</div>
    <h2>Process Steps</h2>
    <p style="max-width:640px;font-size:15px;color:var(--ink2)">Chronological walkthrough of every action captured in the video. Each step links to its full documentation below.</p>
  </div>
  <div class="timeline">
    ${timelineItems}
  </div>
</section>

<hr class="divider">

<section id="steps">
  <div class="reveal">
    <div class="section-label">Section 02 — Step-by-Step Documentation</div>
    <h2>Detailed Action Breakdown</h2>
    <p style="max-width:640px;font-size:15px;color:var(--ink2)">Every step is documented with the exact action, technical mechanism, purpose, and outcome. Frames animate through neighbouring moments for context.</p>
  </div>
  ${segEntries}
</section>

<footer>
  <div>Generated by <span>VideoDoc</span> &bull; ${date}</div>
  <div class="footer-sub">${total} steps documented &bull; ${annotated} AI-annotated &bull; ${durStr}</div>
</footer>

<script>
(function(){
  window.addEventListener('scroll',function(){
    var el=document.documentElement;
    var pct=el.scrollTop/(el.scrollHeight-el.clientHeight)*100;
    document.getElementById('pfill').style.width=pct+'%';
  });
  var obs=new IntersectionObserver(function(en){
    en.forEach(function(e){if(e.isIntersecting)e.target.classList.add('visible')});
  },{threshold:.08});
  document.querySelectorAll('.reveal').forEach(function(el){obs.observe(el)});
})();
</script>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${title}-docs.html`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}

function buildStaticMedia(imageData, label, caption) {
  return `<div class="media-wrap">
    <img src="${imageData}" alt="${esc(label)}">
    <div class="media-caption">${esc(caption)}</div>
  </div>`
}

function buildAnimatedMedia(frames, index, caption) {
  const n = frames.length
  const frameDuration = 0.7        // seconds each frame shows
  const totalDuration = n * frameDuration
  const pct = +(100 / n).toFixed(3)
  const keyframeName = `af${index}`

  // First frame is always visible as the base; others animate on top
  const frameImgs = frames.map((src, i) => {
    const delay = (i * frameDuration).toFixed(2)
    return `<img src="${src}" class="anim-frame" style="animation:${keyframeName} ${totalDuration}s steps(1,end) infinite;animation-delay:${delay}s">`
  }).join('\n    ')

  return `<style>@keyframes ${keyframeName}{0%,${pct}%{opacity:1}${+(pct+0.01).toFixed(3)}%,100%{opacity:0}}</style>
  <div class="anim-wrap" style="min-height:200px">
    ${frameImgs}
    <div class="media-caption" style="position:absolute;bottom:0;left:0;right:0;z-index:2">${esc(caption)}</div>
  </div>`
}
