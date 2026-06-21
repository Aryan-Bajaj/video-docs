// Post-annotation "insights" pass: a facilitator-style Summary, an FAQ
// (questions actually asked in the meeting + likely reader questions), and a
// Mermaid flow diagram of the process. All local (Ollama / WebLLM) — nothing
// leaves the browser. Built to be robust on small 3B/4B local models:
//   - tight, delimited output formats that parse leniently
//   - deterministic fallbacks so a section never comes back empty/broken.

import { callOllama, callWebLLM, cleanLLMOutput } from "./llm"

function callLLM(userMsg, systemPrompt, aiMode, model, onStatus, opts = {}) {
  return aiMode === "ollama"
    ? callOllama(userMsg, systemPrompt, model, opts)
    : callWebLLM(userMsg, systemPrompt, onStatus, { ...opts, model })
}

// One-line heading for a doc (procedure step title / first action / transcript).
function docHeading(d) {
  if (d.step) {
    if (d.step.title) return d.step.title.trim().slice(0, 90)
    if (d.step.steps?.[0]) return d.step.steps[0].trim().slice(0, 90)
  }
  if (d.annotation) return d.annotation.split(/\n/)[0].trim().slice(0, 90)
  return (d.text || "").split(/[.!?\n]/)[0].trim().slice(0, 90)
}

// Compact outline of the whole recording for the summary/FAQ context.
function buildOutline(docs, maxChars = 3500) {
  let out = ""
  for (const d of docs) {
    const line = `[${d.label}] ${docHeading(d)}\n`
    if (out.length + line.length > maxChars) break
    out += line
  }
  return out.trim()
}

// Evenly sample transcript text across the whole video, capped.
function sampleTranscript(chunks, maxChars = 3000) {
  const clean = (chunks || []).filter((c) => c.text?.trim())
  if (!clean.length) return ""
  let joined = clean.map((c) => c.text.trim()).join(" ")
  if (joined.length <= maxChars) return joined
  // keep beginning, middle and end so a summary reflects the whole thing
  const slice = Math.floor(maxChars / 3)
  const mid = Math.floor(joined.length / 2)
  return [
    joined.slice(0, slice),
    joined.slice(mid - slice / 2, mid + slice / 2),
    joined.slice(joined.length - slice),
  ].join(" … ")
}

// Pull only GENUINE, substantive questions asked during the meeting — not
// conversational filler like "okay?" / "right?" / "you know?".
function extractAskedQuestions(chunks, max = 6) {
  const qs = []
  const tag = /\b(okay|ok|right|yeah|yes|no|huh|hmm|alright|see|you know|correct)\s*\?+$/i
  for (const c of chunks || []) {
    const t = (c.text || "").trim()
    if (!t) continue
    for (const s of t.split(/(?<=[.?!])\s+/)) {
      const st = s.trim()
      if (st.length < 15 || st.length > 160) continue
      if (!st.endsWith("?")) continue        // must actually be a question
      if (tag.test(st)) continue             // skip "okay?", "right?" fillers
      if (st.split(/\s+/).length < 4) continue
      if (!/\b(how|what|why|when|where|which|who|can|could|should|would|will|do|does|did|is|are|may)\b/i.test(st)) continue
      qs.push(st.replace(/\s+/g, " "))
    }
    if (qs.length >= max * 2) break
  }
  return [...new Set(qs)].slice(0, max)
}

// ── Purpose (document-level, once) ──
async function genPurpose(outline, transcript, tools, aiMode, model, onStatus) {
  const system = `You write the PURPOSE statement of a Desktop Procedure (SOP). In 2-3 sentences, state what this procedure enables the reader to do and why it matters. No preamble, no "this document". Be specific to the actual task. Do not invent.`
  const toolLine = tools?.length ? `Tools/systems involved: ${tools.join(", ")}.\n` : ""
  const raw = await callLLM(`${toolLine}OUTLINE:\n${outline}\n\nTRANSCRIPT EXCERPTS:\n${transcript}`, system, aiMode, model, onStatus, { maxTokens: 220, temperature: 0.3 })
  return cleanLLMOutput(raw)
}

// ── Prerequisites (document-level, once) → array of bullet strings ──
async function genPrerequisites(outline, transcript, tools, aiMode, model, onStatus) {
  const toolLine = tools?.length ? `Detected tools/systems: ${tools.join(", ")}.\n` : ""
  const system = `List the PREREQUISITES a reader needs BEFORE starting this procedure: access, systems, tools, files, or permissions.
Output ONLY a plain bullet list, 3-6 lines, each starting with "- ".
Do NOT write any preamble, heading, outline, or timestamps. Do NOT explain anything.
Example:
- Access to SAP Business Warehouse
- Microsoft Excel with the Analysis add-in
- Permission to view R&D cost centers`
  const raw = await callLLM(`${toolLine}TASK OUTLINE:\n${outline}`, system, aiMode, model, onStatus, { maxTokens: 220, temperature: 0.2 })
  const lines = cleanLLMOutput(raw)
    .split("\n")
    .map((l) => l.replace(/^[\-\*•\d.\)\s]+/, "").trim())
    .filter((l) => l.length > 3 && l.length < 120)
    .filter((l) => !/\[\d{1,2}:\d{2}/.test(l))                 // drop timestamped outline lines
    .filter((l) => !/\*\*/.test(l))                            // drop markdown headers
    .filter((l) => !/^(outline|okay|here|sure|based on|task outline|tools?\s*\/|this )/i.test(l))
  return [...new Set(lines)].slice(0, 6)
}

// ── Summary ──
async function genSummary(outline, transcript, aiMode, model, onStatus) {
  const system = `You write a comprehensive SUMMARY of a recorded session so a reader who did NOT attend understands the full picture without watching the video.
Cover, in flowing prose (no bullet list, no preamble like "This recording"):
1. The OBJECTIVE — what this session set out to achieve and why it matters.
2. WHAT WAS DONE — the main activities/steps in order.
3. KEY DECISIONS and the reasoning behind them.
4. The OUTCOME and any open points or next steps.
Write 6-10 specific sentences. Do not invent anything not supported below.`
  const user = `OUTLINE (chronological):\n${outline}\n\nTRANSCRIPT EXCERPTS:\n${transcript}`
  const raw = await callLLM(user, system, aiMode, model, onStatus, { maxTokens: 650, temperature: 0.3 })
  return cleanLLMOutput(raw)
}

// ── FAQ ──
// ── Lightweight RAG for FAQ answers ──
// 1) generate good questions, 2) for each, RETRIEVE the most relevant transcript
// chunks (keyword overlap), 3) answer grounded ONLY in those chunks. Far better
// answers than a single echo-prone pass.
const STOP = new Set("the a an of to in on for and or is are was how what why do does did you it this that with at by your our their as be can will would should i we they he she".split(" "))
function tokenize(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))
}
function retrieveChunks(question, chunks, k = 6) {
  const q = new Set(tokenize(question))
  if (!q.size) return []
  return (chunks || [])
    .map((c) => {
      let s = 0
      for (const w of tokenize(c.text)) if (q.has(w)) s++
      return { c, s }
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => x.c)
}

// Drop near-duplicate questions (high significant-word overlap).
function dedupeQuestions(qs) {
  const kept = [], sets = []
  for (const q of qs) {
    const s = new Set(tokenize(q))
    if (!s.size) continue
    let dup = false
    for (const prev of sets) {
      const inter = [...s].filter((w) => prev.has(w)).length
      const uni = new Set([...s, ...prev]).size
      if (uni && inter / uni > 0.55) { dup = true; break }
    }
    if (!dup) { kept.push(q); sets.push(s) }
  }
  return kept
}

async function genFAQQuestions(outline, transcript, asked, aiMode, model, onStatus) {
  const askedBlock = asked.length ? `Questions actually raised in the session:\n${asked.map((q) => `- ${q}`).join("\n")}\n\n` : ""
  const system = `Generate 5-6 DIVERSE, genuinely useful FAQ questions for this procedure's documentation. Each must cover a DIFFERENT angle — pick from:
- the PURPOSE or reasoning behind a key part ("Why is ... done?")
- what a specific term, field, option or value MEANS
- a common pitfall, gotcha, or thing to be careful about
- a decision point ("When should I ...?" / "Which option ...?")
- a question someone in the session actually asked

Rules:
- Do NOT ask "How do I open/access ...?" for each step — the steps already cover that. No repetitive or near-duplicate questions.
- Every question must be clearly DISTINCT from the others, complete, and end with "?".
- Base them on the actual session content below, not generic guesses.
Output ONLY the questions, one per line. No numbering, no answers, no preamble.`
  const user = `${askedBlock}WHAT THE SESSION COVERED (transcript):\n${transcript}\n\nSTEPS (for reference only):\n${(outline || '').slice(0, 1200)}`
  const raw = await callLLM(user, system, aiMode, model, onStatus, { maxTokens: 320, temperature: 0.5 })
  const qs = cleanLLMOutput(raw)
    .split("\n")
    .map((l) => l.replace(/^[\-\*\d.\)\s]+/, "").trim())
    .filter((l) => l.endsWith("?") && l.split(/\s+/).length >= 4)
    .filter((l) => !/^how (do|can) i (open|access|navigate|go)/i.test(l)) // drop step-mirroring "how do I open X"
  return dedupeQuestions(qs).slice(0, 6)
}

async function genFAQ(outline, transcript, asked, transcriptChunks, aiMode, model, onStatus) {
  const questions = await genFAQQuestions(outline, transcript, asked, aiMode, model, onStatus)
  const faqs = []
  for (const q of questions) {
    const hits = retrieveChunks(q, transcriptChunks, 8)
    const ctx = (hits.length ? hits : (transcriptChunks || []).slice(0, 6)).map((c) => c.text).join("\n")
    const system = `Answer this question about a procedure clearly and helpfully.
Use the TRANSCRIPT EXCERPTS below as the PRIMARY source for any specifics (exact names, values, steps).
You MAY add brief, accurate general knowledge about the tools/concepts involved (e.g. Microsoft Excel, SAP Business Warehouse, cost centres) to make the answer clearer and more complete — but do NOT contradict the excerpts, and do NOT invent specific names or values that are not present.
Reply in 1-3 sentences of plain prose. If the question is unrelated to this material, reply EXACTLY "SKIP".

TRANSCRIPT EXCERPTS:
${ctx.slice(0, 2400)}`
    let a = ""
    try { a = cleanLLMOutput(await callLLM(q, system, aiMode, model, onStatus, { maxTokens: 200, temperature: 0.2 })) } catch { /* skip */ }
    if (a && !/^skip\b/i.test(a.trim()) && a.length > 10) faqs.push({ q, a })
  }
  return faqs.filter(isRealFAQ)
}

// Drop junk FAQ entries that slipped through (transcript fragments, filler).
function isRealFAQ({ q, a }) {
  if (!q || !a || a.length < 8) return false
  if (!q.endsWith("?")) return false
  if (/\b(okay|right|yeah|you know|i like|i think)\b/i.test(q) && q.split(/\s+/).length < 7) return false
  if (!/\b(how|what|why|when|where|which|who|can|could|should|would|will|do|does|did|is|are|may)\b/i.test(q)) return false
  return true
}

function parseFAQ(text) {
  if (!text) return []
  const faqs = []
  const re = /Q:\s*([\s\S]*?)\n\s*A:\s*([\s\S]*?)(?=\n\s*Q:|$)/gi
  let m
  while ((m = re.exec(text)) !== null) {
    const q = m[1].replace(/\s+/g, " ").trim()
    const a = m[2].replace(/\s+/g, " ").trim()
    if (q && a) faqs.push({ q, a })
  }
  return faqs.slice(0, 8)
}

// ── Mermaid flow ──
// Deterministic fallback flowchart from the step headings — guarantees a valid
// diagram even if the model returns junk.
function fallbackMermaid(docs) {
  let nodes = docs
    .map((d) => docHeading(d))
    .filter(Boolean)
    .filter((h, i, arr) => h !== arr[i - 1]) // drop consecutive dupes
  // Keep it high-level: at most ~8 nodes, evenly sampled, so the chart is short.
  if (nodes.length > 8) {
    const stepN = nodes.length / 8
    nodes = Array.from({ length: 8 }, (_, k) => nodes[Math.floor(k * stepN)])
  }
  if (!nodes.length) return ""
  let out = "flowchart TD\n"
  nodes.forEach((label, i) => {
    const safe = label.replace(/["\n]/g, " ").replace(/[\[\](){}]/g, "").slice(0, 60)
    out += `  N${i}["${safe}"]\n`
    if (i > 0) out += `  N${i - 1} --> N${i}\n`
  })
  return out
}

function sanitizeMermaid(text, docs) {
  if (!text) return fallbackMermaid(docs)
  // pull a fenced block if present
  const fence = text.match(/```(?:mermaid)?\s*([\s\S]*?)```/i)
  let body = (fence ? fence[1] : text).trim()
  const start = body.search(/\b(flowchart|graph)\b/i)
  if (start === -1) return fallbackMermaid(docs)
  body = body.slice(start).trim()
  // basic validity: must have at least one edge
  if (!/-->/.test(body)) return fallbackMermaid(docs)
  // strip stray markdown / prose lines that aren't mermaid
  const lines = body.split("\n").filter((l) => {
    const t = l.trim()
    return t && !/^(here|this|the |note:)/i.test(t)
  })
  return lines.join("\n")
}

// Structured flow that keeps EVERY step (no info loss) but looks clean: steps
// are grouped into phases, flowing left-to-right inside each phase, phases
// stacked top-down. Far nicer than one long vertical chain. Deterministic, so
// it always renders (no LLM formatting errors).
function buildPhasedMermaid(docs) {
  const titles = (docs || []).map(docHeading).filter(Boolean).filter((h, i, a) => h !== a[i - 1])
  if (!titles.length) return ""
  const phases = Math.min(6, Math.max(1, Math.round(titles.length / 5)))
  const per = Math.ceil(titles.length / phases)
  let out = "flowchart TD\n"
  let id = 0
  const phaseIds = []
  for (let p = 0; p * per < titles.length; p++) {
    const group = titles.slice(p * per, (p + 1) * per)
    const pid = `P${p}`
    phaseIds.push(pid)
    out += `  subgraph ${pid}["Phase ${p + 1}"]\n    direction LR\n`
    const ids = group.map(() => `S${id++}`)
    group.forEach((label, j) => {
      const safe = label.replace(/["\n]/g, " ").replace(/[\[\](){}|]/g, "").slice(0, 46)
      out += `    ${ids[j]}["${safe}"]\n`
    })
    for (let j = 1; j < ids.length; j++) out += `    ${ids[j - 1]} --> ${ids[j]}\n`
    out += `  end\n`
  }
  for (let p = 1; p < phaseIds.length; p++) out += `  ${phaseIds[p - 1]} --> ${phaseIds[p]}\n`
  return out
}

async function genMermaid(outline, docs, aiMode, model, onStatus) {
  onStatus?.("Drawing flow diagram…")
  return buildPhasedMermaid(docs) // every step kept, grouped into phases for a clean structure
}

// Key Observations = the per-step NOTE fields, de-duplicated. Grounded in the
// actual steps, so no extra LLM call and no fabrication.
function collectKeyObservations(docs) {
  const seen = new Set()
  const out = []
  for (const d of docs || []) {
    let n = (d.step?.note || "").replace(/^[\s\-–—•:]+/, "").trim()
    if (n.length > 3 && !/^[-–—.\s]*$/.test(n) && !seen.has(n.toLowerCase())) {
      seen.add(n.toLowerCase()); out.push(n)
    }
  }
  return out.slice(0, 12)
}

// ── Orchestrator ──
// onStatus(label) lets the UI show which insight is being generated.
export async function generateInsights(docs, transcriptChunks, aiMode, model, onStatus, shouldCancel = () => false, tools = []) {
  const empty = { purpose: "", prerequisites: [], keyObservations: [], summary: "", faqs: [], mermaid: "" }
  const usable = (docs || []).filter((d) => d.step || d.annotation || d.text)
  if (!usable.length) return empty

  const outline = buildOutline(usable)
  const transcript = sampleTranscript(transcriptChunks)
  const asked = extractAskedQuestions(transcriptChunks)
  const keyObservations = collectKeyObservations(usable)
  const note = (s) => onStatus?.(s)

  if (shouldCancel()) return { ...empty, keyObservations }
  note("Writing purpose…")
  let purpose = ""
  try { purpose = await genPurpose(outline, transcript, tools, aiMode, model, note) } catch { /* leave blank */ }

  if (shouldCancel()) return { ...empty, purpose, keyObservations }
  note("Listing prerequisites…")
  let prerequisites = []
  try { prerequisites = await genPrerequisites(outline, transcript, tools, aiMode, model, note) } catch { /* leave empty */ }

  if (shouldCancel()) return { ...empty, purpose, prerequisites, keyObservations }
  note("Writing summary…")
  let summary = ""
  try { summary = await genSummary(outline, transcript, aiMode, model, note) } catch { /* leave blank */ }

  if (shouldCancel()) return { ...empty, purpose, prerequisites, keyObservations, summary }
  note("Building FAQ (retrieving answers)…")
  let faqs = []
  try { faqs = await genFAQ(outline, transcript, asked, transcriptChunks, aiMode, model, note) } catch { /* leave empty */ }

  if (shouldCancel()) return { ...empty, purpose, prerequisites, keyObservations, summary, faqs }
  note("Drawing flow diagram…")
  const mermaid = await genMermaid(outline, usable, aiMode, model, note)

  return { purpose, prerequisites, keyObservations, summary, faqs, mermaid }
}
