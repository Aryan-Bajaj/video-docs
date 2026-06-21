// ── Auto documentation prompt (OCR-aware, process-understanding) ──
// Handles BOTH hands-on demonstrations and discussions/meetings: the goal is to
// make the reader understand the process and the reasoning, not just list clicks.
export const SKILL_PROMPT = `You document a screen recording that may be a hands-on demonstration OR a discussion / meeting. You are given the spoken transcript AND the actual on-screen text captured from the screen (OCR).

Your goal is to make a reader UNDERSTAND THE PROCESS — what is being done and WHY — not merely list mouse clicks. Capture the purpose, the reasoning, and the decisions discussed. Use the on-screen text to name the EXACT buttons, menus, tabs, fields, file names and shortcuts, even if no one says them out loud.

Write EXACTLY in this format:

OVERVIEW: [2-3 sentences in plain language: what is happening in this part and its purpose/context, so a newcomer grasps the bigger picture]
STEPS:
1. [If a demonstration: one concrete action, naming the exact on-screen element. If a discussion: one key point, decision, or question raised.]
2. [Next]
3. [Continue — 2 to 6 items]
RESULT: [One sentence — what is achieved, decided, or concluded]

Rules:
- Prioritise understanding: explain the "why" behind the actions and the decisions made in discussion, not only the mechanics.
- Prefer exact names from the on-screen text over vague words.
- Do not invent actions or facts not supported by the transcript or screen.
- If this segment is off-topic small talk, a greeting, or has no real content, reply with EXACTLY:
  OVERVIEW: Off-topic — no documented process in this segment.
  and write nothing else. Never fabricate steps to fill space.
- Keep each step under 20 words.`

// ── Desktop Procedure prompt ──
// Each segment → one followable phase of the procedure (a title + ordered
// actions + result + optional note), exactly the way the trainer demonstrates
// it. Off-topic / silent / small-talk segments return SKIP and are dropped.
export const PROCEDURE_PROMPT = `You are writing part of a professional Desktop Procedure (SOP) from a screen recording, the way the trainer demonstrates it. You receive the spoken transcript AND the on-screen text (OCR) for ONE segment.

If this segment contains real, followable actions (navigating, clicking, configuring, selecting, deciding), output EXACTLY:

TITLE: <short phase title, max 8 words, e.g. "Open the BW analysis">
STEPS:
1. <one concrete action a reader can follow — name the EXACT menu / button / tab / field / shortcut seen on screen>
2. <next action, in order>
3. <continue, 1-6 actions>
RESULT: <what the user achieves or sees after these actions; one sentence>
NOTE: <one key observation, tip, or warning — or "-" if none>

If this segment is a greeting, small talk, off-topic chatter, a pause, or has no real action, output EXACTLY:
SKIP

Rules:
- Write imperative, followable steps: "Go to the Analysis tab", "Click Business Warehouse", "Select the R&D query".
- Use the on-screen (OCR) text to name things EXACTLY, even if the trainer does not say them aloud.
- Say WHERE each element is, not just its name — the application and its ribbon / menu / tab / panel — so a reader can find it. Example: "In Excel, on the Analysis ribbon, click Business Warehouse." Use the screen and your knowledge of the application to give this location.
- Steps must be in the order they happen. Only describe what the transcript or screen supports — never invent clicks.
- IMPORTANT: If this segment only CONTINUES the same action already covered in [Previous] and shows nothing new, reply SKIP. Do not repeat a step that was already done — only document genuinely new actions.`

// Appended to the prompt when a screenshot is sent to a vision model, so it
// behaves like a human: listens AND looks, and resolves vague spoken references.
export const VISION_ADDENDUM = `

You are ALSO given a SCREENSHOT of this exact moment. Use BOTH the spoken transcript AND the screen together, like a person watching the recording:
- Focus ONLY on the shared application window. IGNORE the small webcam / video-call tiles and the people's names listed beside them — they are NOT part of the procedure.
- When the speaker says vague words like "here", "this", "that" or "click there", LOOK at the screen to find the EXACT button, menu, tab, or field, and name it.
- Only state UI text you can actually read on screen. Do NOT guess or invent labels you cannot clearly see.
- If the screenshot shows only a webcam, a photo, a desktop, or no real application screen, reply SKIP.`

// Parse a procedure-step reply → { skip } or { title, steps[], result, note }.
export function parseProcedureStep(text) {
  if (!text) return { skip: true }
  const t = text.trim()
  if (/^SKIP\b/i.test(t) && t.length < 24) return { skip: true }
  const title = (t.match(/TITLE:\s*(.+)/i)?.[1] || '').trim()
  const stepsBlock = t.match(/STEPS?:\s*([\s\S]*?)(?=\n\s*RESULT:|\n\s*NOTE:|$)/i)?.[1] || ''
  const steps = stepsBlock
    .split('\n')
    .map((l) => l.replace(/^[\d\-\*•]+[.\):\s]+/, '').trim())
    .filter((l) => l.length > 2)
  const result = (t.match(/RESULT:\s*([\s\S]*?)(?=\n\s*NOTE:|$)/i)?.[1] || '').trim()
  let note = (t.match(/NOTE:\s*([\s\S]*)$/i)?.[1] || '').trim()
  note = note.replace(/^[\s\-–—•:]+/, '').trim()              // strip leading dash/bullet ("– This opens…")
  if (note.length < 3 || /^(none|n\/a|na)$/i.test(note) || /^[-–—.\s]*$/.test(note)) note = '' // drop empty / dash-only
  if (!steps.length && !title) return { skip: true }
  return { skip: false, title, steps, result, note }
}

// ── Structured documentation prompt (richer, like a real guide) ──
export function buildSectionsPrompt(sections) {
  const sectionList = sections.map((s) => `${s}: [2-3 specific sentences]`).join('\n')
  return `You are a professional technical documentation writer. You receive the spoken transcript AND the on-screen text (OCR) of a screen recording.

Write documentation for this segment using EXACTLY these sections. Name exact UI elements, buttons, menus and files visible on screen.

${sectionList}

Rules:
- Use EXACTLY the section names above, each followed by a colon.
- Be specific and actionable — what to click, where to navigate, what happens.
- Use the on-screen text to get exact names right.
- Reply with ONLY the sections in the format above.`
}

// Context block fed to the model per window, now including on-screen (OCR) text.
export function buildContextPrompt(text, label, prevText, nextText, ocrText) {
  const spoken = text
    ? `[Spoken at ${label}]: "${text}"`
    : `[At ${label}]: (no narration here — describe the action purely from the on-screen text)`
  return [
    prevText ? `[Previous]: "${prevText}"` : null,
    spoken,
    nextText ? `[Next]: "${nextText}"` : null,
    ocrText ? `[On-screen text (OCR)]: "${ocrText}"` : null,
  ].filter(Boolean).join('\n')
}

// ── Chunking: merge tiny transcript segments into ~windowSecs windows ──
// Big videos produce hundreds of micro-segments; one LLM call each is slow and
// context-poor. Grouping into windows gives the model coherent chunks and cuts
// the number of calls dramatically.
export function groupIntoWindows(chunks, windowSecs = 45) {
  const clean = (chunks || []).filter((c) => c.text?.trim())
  if (!clean.length) return []
  const windows = []
  let cur = null
  for (const c of clean) {
    const start = c.timestamp?.[0] ?? 0
    const end = c.timestamp?.[1] ?? start + 3
    if (!cur || start - cur.timestamp[0] >= windowSecs) {
      if (cur) windows.push(cur)
      cur = { text: c.text.trim(), timestamp: [start, end] }
    } else {
      cur.text += ' ' + c.text.trim()
      cur.timestamp[1] = end
    }
  }
  if (cur) windows.push(cur)
  return windows
}

// ── Parsers ──
export function parseSectionedAnnotation(text, sections) {
  if (!sections?.length || !text) return null
  const result = {}
  sections.forEach((section, i) => {
    const esc = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const nextEsc = sections[i + 1]?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = nextEsc
      ? new RegExp(`${esc}:\\s*([\\s\\S]*?)(?=\\n${nextEsc}:)`, 'i')
      : new RegExp(`${esc}:\\s*([\\s\\S]*)`, 'i')
    const match = text.match(pattern)
    if (match) result[section] = match[1].trim()
  })
  return Object.keys(result).length >= 1 ? result : null
}

export function parseStepsAnnotation(text) {
  if (!text) return null
  const overviewMatch = text.match(/OVERVIEW:\s*([\s\S]*?)(?=\n\s*STEPS?:|\n\s*RESULT:|$)/i)
  const stepsMatch = text.match(/STEPS?:\s*([\s\S]*?)(?=RESULT:|$)/i)
  const resultMatch = text.match(/RESULT:\s*([\s\S]*)$/i)
  const overview = overviewMatch?.[1]?.trim() || null
  const steps = stepsMatch
    ? stepsMatch[1]
        .split('\n')
        .map((l) => l.replace(/^[\d\-\*•]+[\.\):\s]+/, '').trim())
        .filter((l) => l.length > 3)
    : []
  const result = resultMatch?.[1]?.trim() ?? null
  // Valid if we got an overview (e.g. off-topic) OR at least one step.
  return (overview || steps.length > 0) ? { overview, steps, result } : null
}
