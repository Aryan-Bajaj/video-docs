// Self-evaluation of a finished procedure — NO ground truth needed. It gives a
// quick, repeatable signal of how CLEAN the output is, so after each change you can
// see whether the result actually got better (higher score = cleaner).
//
// It looks for the failure modes we keep hitting:
//   • "unclear / garbled / cannot confirm" notes  → the model couldn't read the screen
//   • two or more DIFFERENT apps named            → app hallucination (e.g. SAP + Salesforce)
//   • leftover meeting-logistics / person steps   → noise that slipped through
const UNCLEAR_RE = /\b(unclear|garbled|cannot confirm|not (present|supported|possible|clear)|no (clear|legible|recognizable)|nonsensical|insufficient|garbage|illegible|without further clarification)\b/i
const LOGISTICS_RE = /\b(mute|unmute|teams call|zoom call|meeting attendees?|participants?|'s (finance|info|profile)|access \w+ profile)\b/i
const KNOWN_APPS = ["excel", "power bi", "power query", "word", "powerpoint", "salesforce", "tableau", "google sheets", "sap bw"]

export function evaluateDoc(docs) {
  const list = (docs || []).filter((d) => d.step)
  const n = list.length || 1
  let unclear = 0, logistics = 0
  const appsNamed = new Set()
  for (const d of list) {
    const text = [d.step.title, ...(d.step.steps || []), d.step.result, d.step.note].filter(Boolean).join(" ")
    if (UNCLEAR_RE.test(text)) unclear++
    if (LOGISTICS_RE.test(text)) logistics++
    const low = text.toLowerCase()
    for (const a of KNOWN_APPS) if (low.includes(a)) appsNamed.add(a)
  }
  const appInconsistency = Math.max(0, appsNamed.size - 1) // >1 distinct app named = likely hallucination
  const penalty = (unclear * 0.6 + logistics * 0.8 + appInconsistency * 2) / n
  const score = Math.max(0, Math.min(100, Math.round(100 * (1 - penalty))))
  return {
    steps: list.length,
    unclearRate: Math.round((100 * unclear) / n),  // % of steps the model couldn't ground
    logisticsSteps: logistics,                     // meeting/person noise that leaked
    appsNamed: [...appsNamed],                      // ideally 0-1 distinct apps
    score,                                          // 0-100, higher = cleaner
  }
}
