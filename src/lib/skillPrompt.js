// ── Auto step-by-step prompt (OCR-aware) ──
export const SKILL_PROMPT = `You write clear, professional step-by-step software documentation from a screen-recording transcript.

You are given the spoken transcript AND the actual on-screen text captured from the screen (OCR). Use the on-screen text to name the EXACT buttons, menus, tabs, fields, file names and shortcuts the user interacts with — even if the narrator does not say them out loud.

Write EXACTLY in this format:

STEPS:
1. [One specific action — name the exact button / menu / tab / shortcut / field seen on screen]
2. [Next specific action]
3. [Continue — 2 to 6 steps]

RESULT: [One sentence — what the user sees or achieves after these steps]

Rules:
- Each step is ONE executable action (e.g. "Press Alt+F11 to open the VBA editor", "Click the Developer tab in the Excel ribbon").
- Prefer exact names from the on-screen text over vague words.
- Steps in correct order; do not invent actions not supported by the transcript or screen.
- Keep each step under 16 words.`

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
  const stepsMatch = text.match(/STEPS?:\s*([\s\S]*?)(?=RESULT:|$)/i)
  const resultMatch = text.match(/RESULT:\s*([\s\S]*)$/i)
  if (!stepsMatch) return null
  const steps = stepsMatch[1]
    .split('\n')
    .map((l) => l.replace(/^[\d\-\*•]+[\.\):\s]+/, '').trim())
    .filter((l) => l.length > 3)
  const result = resultMatch?.[1]?.trim() ?? null
  return steps.length > 0 ? { steps, result } : null
}
