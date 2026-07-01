// Common Whisper mis-hearings for this domain — applied to the transcript before
// annotation / insights so downstream text is right. Add more pairs as needed.
const FIXUPS = [
  [/\bcall (cent(?:er|re)s?)\b/gi, "cost $1"],   // "call center" → "cost center"
  [/\bcode (cent(?:er|re)s?)\b/gi, "cost $1"],   // "code center" → "cost center"
  [/\bcoast (cent(?:er|re)s?)\b/gi, "cost $1"],  // "coast center" → "cost center"
]

export function fixTranscriptText(text) {
  let t = text || ""
  for (const [re, rep] of FIXUPS) t = t.replace(re, rep)
  return t
}

export function fixTranscriptChunks(chunks) {
  return (chunks || []).map((c) => ({ ...c, text: fixTranscriptText(c.text) }))
}
