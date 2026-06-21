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

// Parse OVERVIEW: / STEPS: / RESULT: format
function parseSteps(text) {
  if (!text) return null
  const overviewMatch = text.match(/OVERVIEW:\s*([\s\S]*?)(?=\n\s*STEPS?:|\n\s*RESULT:|$)/i)
  const stepsMatch = text.match(/STEPS?:\s*([\s\S]*?)(?=RESULT:|$)/i)
  const resultMatch = text.match(/RESULT:\s*([\s\S]*)$/i)
  const overview = overviewMatch?.[1]?.trim() || null
  const steps = stepsMatch
    ? stepsMatch[1]
        .split('\n')
        .map(l => l.replace(/^[\d\-\*•]+[\.\):\s]+/, '').trim())
        .filter(l => l.length > 3)
    : []
  const result = resultMatch?.[1]?.trim() ?? null
  return (overview || steps.length > 0) ? { overview, steps, result } : null
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

// Render one procedure step's actions + result + note (from doc.step).
function buildStepBlock(doc) {
  const step = doc.step
  if (!step) {
    return doc.annotation
      ? `<div class="ann-block" style="border-left-color:#b8932a"><div class="ann-body">${mdToHtml(doc.annotation)}</div></div>`
      : ''
  }
  const actions = (step.steps || []).map((s, i) => `
      <div class="step-row">
        <div class="step-badge">${i + 1}</div>
        <p class="step-text">${esc(s)}</p>
      </div>`).join('')
  const body = actions || (step.title
    ? `<div style="padding:11px 14px;color:var(--ink2);font-size:13.5px">${esc(step.title)}</div>` : '')
  const resultBlock = step.result ? `
      <div class="result-row">
        <div class="result-icon">✓</div>
        <p class="result-text">${esc(step.result)}</p>
      </div>` : ''
  const noteBlock = step.note ? `
      <div class="note-row">
        <div class="note-icon">!</div>
        <p class="note-text">${esc(step.note)}</p>
      </div>` : ''
  return `
      <div class="steps-block">
        <div class="steps-header">Actions</div>
        ${body}
        ${resultBlock}
        ${noteBlock}
      </div>`
}

// Caption text from transcript (first ~60 chars cleaned)
function captionFromTranscript(text) {
  return text.trim().slice(0, 65).replace(/\s+\S*$/, '') + (text.length > 65 ? '…' : '')
}

export async function exportHTML(docs, videoName, allFrames, meta = {}) {
  // Prefer the user-given title; only fall back to a generic heading (never the video file name).
  const title = (meta.title && meta.title.trim()) || 'Step-by-Step Guide'
  const company = (meta.company && meta.company.trim()) || ''
  const insights = meta.insights || {}
  const mermaidSvg = meta.mermaidSvg || ''
  const tools = meta.tools || []
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const annotated = docs.filter(d => d.annotation).length
  const total = docs.length
  const lastTs = docs[docs.length - 1]?.endTimestamp ?? docs[docs.length - 1]?.timestamp ?? 0
  const durStr = `${Math.floor(lastTs / 60)}m ${Math.floor(lastTs % 60)}s`

  const gifs = meta.gifs instanceof Map ? meta.gifs : new Map()
  const clips = meta.clips instanceof Map ? meta.clips : new Map()

  // Procedure steps — one numbered "Step N: <title>" per documented segment.
  const segEntries = docs.map((doc, i) => {
    const clipFrames = getClipFrames(allFrames, doc.timestamp, 15)
    const stepBlock = buildStepBlock(doc)
    const stepTitle = doc.step?.title || captionFromTranscript(doc.text || '') || `Step ${i + 1}`
    const caption = captionFromTranscript(doc.text || '')
    const clip = clips.get(doc.timestamp)
    const gif = gifs.get(doc.timestamp)

    // Prefer a sharp WebM clip; fall back to GIF, then a frame slideshow.
    const mediaHtml = clip
      ? `<figure class="seg-media"><video src="${clip}" autoplay muted loop playsinline style="width:100%;height:auto;display:block;max-height:420px;object-fit:contain;border-radius:8px"></video>${caption ? `<figcaption class="seg-caption">${esc(caption)}</figcaption>` : ''}</figure>`
      : gif
      ? `<figure class="seg-media"><img src="${gif}" alt="${esc(stepTitle)}" style="width:100%;height:auto;display:block;max-height:420px;object-fit:contain;border-radius:8px">${caption ? `<figcaption class="seg-caption">${esc(caption)}</figcaption>` : ''}</figure>`
      : clipFrames.length > 1
        ? buildAnimatedMedia(clipFrames, i, caption)
        : clipFrames.length === 1
          ? buildStaticMedia(clipFrames[0], stepTitle, caption)
          : `<div class="seg-no-frame"><span>${esc(stepTitle)}</span></div>`

    return `
    <div class="seg-entry reveal" id="step-${i + 1}" style="transition-delay:0.05s">
      <div class="seg-step-header">
        <span class="step-num">Step ${i + 1}</span>
        <h3 class="step-title">${esc(stepTitle)}</h3>
        <span class="step-ts">${esc(doc.label)}</span>
      </div>
      <div class="seg-body">
        <div class="seg-media-col">
          ${mediaHtml}
        </div>
        <div class="seg-content-col">
          <div class="ann-blocks">
            ${stepBlock || '<p class="no-ann">No actions captured</p>'}
          </div>
        </div>
      </div>
    </div>`
  }).join('\n')

  // ── Insights blocks: Summary, Flow diagram, FAQ accordion ──
  const summaryHtml = insights.summary ? `
  <section id="summary">
    <div class="reveal">
      <div class="section-label">Overview</div>
      <h2>Executive Summary</h2>
      <div class="summary-card">${mdToHtml(insights.summary)}</div>
    </div>
  </section>
  <hr class="divider">
` : ''

  const flowHtml = mermaidSvg ? `
  <section id="flow">
    <div class="reveal">
      <div class="section-label">Process Flow</div>
      <h2>Flow Diagram</h2>
      <p style="max-width:640px;font-size:15px;color:var(--ink2);margin-bottom:6px">A visual map of how the steps connect, end to end.</p>
      <div class="flow-card">${mermaidSvg}</div>
    </div>
  </section>
  <hr class="divider">
` : ''

  const faqs = Array.isArray(insights.faqs) ? insights.faqs : []
  const faqHtml = faqs.length ? `
  <section id="faq">
    <div class="reveal">
      <div class="section-label">Questions &amp; Answers</div>
      <h2>FAQ</h2>
      <p style="max-width:640px;font-size:15px;color:var(--ink2);margin-bottom:10px">Questions raised during the session, plus ones a new reader may have. Click a question to expand.</p>
      <div class="faq-list">
        ${faqs.map((f, i) => `
        <details class="faq-item"${i === 0 ? ' open' : ''}>
          <summary class="faq-q"><span class="faq-q-text">${esc(f.q)}</span><span class="faq-chev">+</span></summary>
          <div class="faq-a">${mdToHtml(f.a)}</div>
        </details>`).join('')}
      </div>
    </div>
  </section>
  <hr class="divider">
` : ''

  // ── Document-level sections: Purpose, Prerequisites, Key Observations ──
  const purpose = insights.purpose || ''
  const prerequisites = Array.isArray(insights.prerequisites) ? insights.prerequisites : []
  const keyObs = Array.isArray(insights.keyObservations) ? insights.keyObservations : []

  const purposeHtml = purpose ? `
  <section id="purpose">
    <div class="reveal">
      <div class="section-label">Section 01 — Purpose</div>
      <h2>Purpose</h2>
      <div class="summary-card">${mdToHtml(purpose)}</div>
    </div>
  </section>
  <hr class="divider">
` : ''

  const prereqHtml = (prerequisites.length || tools.length) ? `
  <section id="prerequisites">
    <div class="reveal">
      <div class="section-label">Section 02 — Before You Start</div>
      <h2>Prerequisites</h2>
      <ul class="prereq-list">
        ${prerequisites.map(p => `<li>${esc(p)}</li>`).join('')}
        ${tools.length ? `<li><strong>Tools / systems:</strong> ${tools.map(esc).join(', ')}</li>` : ''}
      </ul>
    </div>
  </section>
  <hr class="divider">
` : ''

  const keyObsHtml = keyObs.length ? `
  <section id="observations">
    <div class="reveal">
      <div class="section-label">Key Observations</div>
      <h2>Key Observations &amp; Notes</h2>
      <ul class="obs-list">
        ${keyObs.map(o => `<li>${esc(o)}</li>`).join('')}
      </ul>
    </div>
  </section>
  <hr class="divider">
` : ''

  // ── Full transcript: HIDDEN from readers, embedded only so the document can
  // be fed to an AI assistant for deeper Q&A (machine-readable context). ──
  const transcript = Array.isArray(meta.transcript) ? meta.transcript : []
  const transcriptHtml = transcript.length ? `
  <!-- FULL TRANSCRIPT (hidden — for AI context only, not shown to readers) -->
  <div id="videodoc-transcript" data-purpose="ai-context" aria-hidden="true" style="display:none">
${transcript.map((c) => {
    const ts = c.timestamp?.[0] ?? 0
    const m = Math.floor(ts / 60).toString().padStart(2, '0')
    const s = Math.floor(ts % 60).toString().padStart(2, '0')
    return `[${m}:${s}] ${esc(c.text || '')}`
  }).join('\n')}
  </div>
` : ''

  // ── Index / Table of Contents (transcript is hidden, so not listed) ──
  const tocSections = [
    summaryHtml ? ['#summary', 'Executive Summary'] : null,
    purposeHtml ? ['#purpose', 'Purpose'] : null,
    prereqHtml ? ['#prerequisites', 'Prerequisites'] : null,
    ['#procedure', 'Procedure'],
    keyObsHtml ? ['#observations', 'Key Observations'] : null,
    faqHtml ? ['#faq', 'FAQ'] : null,
    flowHtml ? ['#flow', 'Process Flow'] : null,
  ].filter(Boolean)

  const tocHtml = `
  <section id="index">
    <div class="reveal">
      <div class="section-label">Contents</div>
      <h2>Index</h2>
      <ol class="toc">
        ${tocSections.map(([href, label]) => `<li><a href="${href}">${esc(label)}</a></li>`).join('')}
      </ol>
      ${docs.length ? `<div class="toc-steps">
        <div class="toc-steps-label">Procedure steps</div>
        <ol class="toc-step-list">
          ${docs.map((d, i) => `<li><a href="#step-${i + 1}">${esc(d.step?.title || captionFromTranscript(d.text || '') || ('Step ' + (i + 1)))}</a></li>`).join('')}
        </ol>
      </div>` : ''}
    </div>
  </section>
  <hr class="divider">
`

  const navExtra = [
    ['#index', 'Index'],
    purposeHtml ? ['#purpose', 'Purpose'] : null,
    ['#procedure', 'Procedure'],
    summaryHtml ? ['#summary', 'Summary'] : null,
    faqHtml ? ['#faq', 'FAQ'] : null,
  ].filter(Boolean).map(([h, l]) => `<li><a href="${h}">${esc(l)}</a></li>`).join('')

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
.nav-company{font-size:13px;font-weight:700;color:var(--ink);letter-spacing:.02em;background:var(--paper3);border:1px solid var(--border2);padding:5px 14px;border-radius:20px;white-space:nowrap}
.pbar{position:fixed;top:60px;left:0;right:0;height:2px;background:var(--border);z-index:99}

/* SUMMARY */
.summary-card{background:white;border:1px solid var(--border2);border-left:4px solid var(--teal);border-radius:var(--r-lg);padding:26px 30px;margin-top:24px;font-size:15.5px;line-height:1.85;color:var(--ink)}
.summary-card p{margin-bottom:12px}.summary-card p:last-child{margin-bottom:0}
.summary-card strong{font-weight:600}.summary-card ul{padding-left:20px;margin:8px 0}

/* FLOW DIAGRAM */
.flow-card{background:white;border:1px solid var(--border2);border-radius:var(--r-lg);padding:30px;margin-top:20px;text-align:center;overflow-x:auto}
.flow-card svg{max-width:100%;height:auto}

/* FAQ ACCORDION */
.faq-list{margin-top:22px;display:flex;flex-direction:column;gap:10px}
.faq-item{background:white;border:1px solid var(--border2);border-radius:var(--r);overflow:hidden;transition:box-shadow .2s}
.faq-item[open]{box-shadow:0 6px 28px rgba(0,0,0,.07)}
.faq-q{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 20px;font-size:15px;font-weight:600;color:var(--ink);user-select:none}
.faq-q::-webkit-details-marker{display:none}
.faq-q:hover{background:var(--paper2)}
.faq-chev{flex-shrink:0;width:22px;height:22px;border-radius:50%;background:var(--gold-light);color:var(--gold-dark);font-size:16px;font-weight:700;line-height:22px;text-align:center;transition:transform .2s}
.faq-item[open] .faq-chev{transform:rotate(45deg)}
.faq-a{padding:0 20px 18px;font-size:14.5px;line-height:1.75;color:var(--ink2);border-top:1px solid var(--border)}
.faq-a p{margin:12px 0 0}.faq-a ul{padding-left:20px;margin:8px 0}

/* INDEX / TOC */
.toc{margin:20px 0 0;padding-left:22px;columns:2;column-gap:40px}
.toc li{margin-bottom:7px;font-size:14.5px;font-weight:600}
.toc li a{color:var(--ink);text-decoration:none;border-bottom:1px solid transparent}
.toc li a:hover{border-bottom-color:var(--gold)}
.toc-steps{margin-top:22px;background:white;border:1px solid var(--border2);border-radius:var(--r-lg);padding:18px 24px}
.toc-steps-label{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);margin-bottom:10px}
.toc-step-list{margin:0;padding-left:22px;columns:2;column-gap:40px}
.toc-step-list li{margin-bottom:6px;font-size:13.5px;color:var(--ink2)}
.toc-step-list li a{color:var(--ink2);text-decoration:none}
.toc-step-list li a:hover{color:var(--gold-dark)}

/* PREREQUISITES & OBSERVATIONS */
.prereq-list,.obs-list{margin-top:18px;background:white;border:1px solid var(--border2);border-radius:var(--r-lg);padding:18px 24px 18px 40px}
.prereq-list li,.obs-list li{margin-bottom:9px;font-size:15px;line-height:1.7;color:var(--ink)}
.prereq-list li:last-child,.obs-list li:last-child{margin-bottom:0}
.obs-list{border-left:4px solid var(--gold)}

/* STEP TITLE in header */
.step-title{font-size:15px;font-weight:600;color:var(--ink);flex:1;line-height:1.35;margin:0}

/* NOTE row in a step */
.note-row{display:flex;align-items:flex-start;gap:12px;padding:10px 14px;background:#fbf3df;border-top:1px solid rgba(184,147,42,.25)}
.note-icon{width:22px;height:22px;border-radius:50%;background:var(--ink2);color:white;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.note-text{font-size:13px;color:var(--ink2);line-height:1.55;flex:1;font-style:italic}

/* TRANSCRIPT APPENDIX */
.transcript-box{margin-top:18px;background:white;border:1px solid var(--border2);border-radius:var(--r-lg);overflow:hidden}
.transcript-toggle{cursor:pointer;list-style:none;padding:14px 20px;font-size:14px;font-weight:600;color:var(--ink);background:var(--paper2);user-select:none}
.transcript-toggle::-webkit-details-marker{display:none}
.transcript-toggle:hover{background:var(--paper3)}
.transcript-body{padding:16px 20px;max-height:480px;overflow-y:auto;border-top:1px solid var(--border)}
.tline{font-size:13.5px;line-height:1.7;color:var(--ink2);margin-bottom:7px;display:flex;gap:10px}
.tts{flex-shrink:0;font-family:monospace;font-size:11.5px;font-weight:700;color:var(--gold-dark);background:var(--gold-light);padding:1px 7px;border-radius:10px;height:fit-content}
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
.ann-overview{padding:11px 14px;font-size:13.5px;line-height:1.7;color:var(--ink2);background:var(--paper2);border-bottom:1px solid var(--border)}
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
      ${navExtra}
      <li><a href="#steps">Documentation</a></li>
    </ul>
    ${company ? `<span class="nav-company">${esc(company)}</span>` : ''}
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
      <div class="stat gold">
        <span class="stat-n">${durStr}</span>
        <span class="stat-l">Recording Length</span>
      </div>
      <div class="stat">
        <span class="stat-n">${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</span>
        <span class="stat-l">${new Date().getFullYear()}</span>
      </div>
    </div>
  </div>
</div>

<hr class="divider">
${tocHtml}
${summaryHtml}
${purposeHtml}
${prereqHtml}
<section id="procedure">
  <div class="reveal">
    <div class="section-label">Procedure</div>
    <h2>Step-by-Step Procedure</h2>
    <p style="max-width:640px;font-size:15px;color:var(--ink2)">Follow these steps in order to complete the procedure. Each step lists the exact actions, the result, and any key note, with a screen capture.</p>
  </div>
  ${segEntries}
</section>

<hr class="divider">
${keyObsHtml}
${faqHtml}
${flowHtml}
${transcriptHtml}
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
