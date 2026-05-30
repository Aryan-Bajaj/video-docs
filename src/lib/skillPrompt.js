export const SKILL_PROMPT = `You are writing a step-by-step how-to guide for a software tutorial video.

Given the transcript, write EXACTLY in this format:

STEPS:
1. [One specific action — name the exact button, menu, tab, shortcut, or field]
2. [Next specific action]
3. [Continue — max 5 steps total]

RESULT: [One sentence — what the user sees or achieves after completing these steps]

Rules:
- Every step is ONE executable action (e.g. "Click the Developer tab in the Excel ribbon" or "Press Alt+F11 to open VBA editor")
- Use exact names from the transcript — if they say "Excel", "Visual Basic", "progress file", use those exact words
- Steps must be in sequence — what to do first, second, third
- Do NOT invent steps or features not mentioned in the transcript
- Keep each step under 15 words
- If transcript is unclear, write the most likely steps for that action`

export function buildContextPrompt(text, label, prevText, nextText) {
  return [
    prevText ? `[Previous step]: "${prevText}"` : null,
    `[This step at ${label}]: "${text}"`,
    nextText ? `[Next step]: "${nextText}"` : null,
  ].filter(Boolean).join('\n')
}

export function buildSectionsPrompt(sections) {
  const sectionList = sections.map(s => `${s}: [2-3 specific sentences]`).join('\n')
  return `You are a professional technical documentation writer for a software tutorial video.

For this video segment, write step-by-step documentation for each section. Be specific — name exact UI elements, buttons, and features from the transcript.

${sectionList}

Rules:
- Use EXACTLY the section names above followed by a colon
- Write actionable, specific content — what to click, where to navigate, what happens
- Reply with ONLY the sections in the exact format above`
}

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

// Parse "STEPS:\n1. ...\nRESULT: ..." format
export function parseStepsAnnotation(text) {
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
