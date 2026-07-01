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

GROUNDING RULES — follow strictly. Inventing ANY detail destroys the document's credibility:
- Describe ONLY what the transcript and on-screen (OCR) text actually support. If you are not sure an action happened, leave it out.
- Name an application, window, menu, button, tab, or field ONLY if that exact name appears in the on-screen text. If you cannot identify the exact name, describe the action generically ("open the report", "select the field", "expand the row") — do NOT guess a label.
- NEVER assume which software it is. Do NOT write "Excel", "Power BI", "Word", "Power Query", "Power Pivot", etc. unless that exact name is on screen. Different tools look alike; naming the wrong one makes the whole step wrong.
- NEVER invent a tool, feature, dialog, ribbon, or button that is not on screen (for example: do NOT invent "AI Comparison tool", "Get Data", "Data Validation", "Change Column Type", "Query Designer" unless you can read it).
- NEVER use a person's name (a meeting participant, a name shown beside a webcam tile) as a field value, query, search term, file name, or data entry. Those are people on the call, not procedure data.
- Write imperative, followable steps in the order they happen: "Go to the Analysis tab", "Click Business Warehouse", "Select the R&D query".
- Prefer the SPECIFIC action over generic navigation. If a setting is changed, a value typed, a dimension/field added, an option toggled, or an item configured, THAT is the step — capture it concretely (e.g. "Set Row Height to Super condensed", "Add the Cluster dimension to Rows", "Swap the axes", "Set the table type to Crosstab"). Do NOT reduce real configuration work to a vague "open" or "navigate to" a screen when an actual change is being made.
- People talk casually while they work — vague speech ("yeah", "let me see", "that should be fine") does NOT mean nothing happened. If the on-screen evidence shows a concrete UI state or change (an open dialog, a menu, a selection, a value), document THAT. Vague talk + clear screen = document the screen.
- STATE vs ACTION: write "Click/Open/Select X" ONLY when that action is evidenced (spoken, or the screen shows it happening). If the screen simply SHOWS a view that is already open, phrase the step from the state: "On the X view, review/configure …" — never fabricate the click that got there.
- A transient system message (session expired, unsaved-changes warning, autosave popup) is NOT a procedure step. If relevant, mention it in NOTE ("If a warning about unsaved changes appears, choose Save"); never make "read the message" a step.
- If this segment only CONTINUES an action already covered in [Previous] and shows nothing new, output SKIP. Never repeat a step already done.
- IGNORE meeting and audio/video logistics — they are talk ABOUT the call, never steps of the procedure. This includes (not an exhaustive list): muting / unmuting and mic checks ("you're muted", "mute yourself", "can you hear me"), screen-share coordination ("can you see my screen", "let me share", "are you seeing this"), connection problems ("you're breaking up", "I lost you", "your video froze"), camera talk, greetings, goodbyes, scheduling, recording reminders, and any small talk. Never turn "how to mute" or "how to share your screen" into a documented step. If a segment is only this kind of talk, output SKIP.
- Output SKIP only when BOTH the narration AND the screen evidence give too little for a real action. A short, accurate procedure is better than an invented one — but a missing step someone needed is just as bad as an invented one.`

// Appended to the prompt when a screenshot is sent to a vision model, so it
// behaves like a human: listens AND looks, and resolves vague spoken references.
export const VISION_ADDENDUM = `

You are ALSO given a SCREENSHOT of this exact moment. Use BOTH the spoken transcript AND the screen together, like a person watching the recording:
- Focus ONLY on the shared application window. IGNORE the small webcam / video-call tiles and the people's names listed beside them — they are NOT part of the procedure and must NEVER be used as data, values, names, or search terms in a step.
- Identify the application ONLY from what is actually visible (title bar, tab labels, the URL in the address bar, menu names). State its name only if you can read it. Do NOT assume it is Excel, Power BI, Word, or any specific product unless its name is on screen.
- Name views/windows by READING their visible title. If the window header says "Data Analyzer" or the page heading says "Landing Page Segments", use exactly that — never substitute a product or module name you know from elsewhere (e.g. do NOT call it "Business Warehouse" because the domain sounds like it).
- The screenshot is evidence of EQUAL weight to the transcript. In a working session people mostly talk vaguely while doing concrete things — when the speech says little but the screen clearly shows an open dialog, menu, panel, or configuration in progress, document what the SCREEN shows and name the visible elements.
- When the speaker says vague words like "here", "this", "that" or "click there", LOOK at the screen to find the EXACT button, menu, tab, or field, and name it.
- Only state UI text you can actually READ on screen. Do NOT guess or invent labels, menus, dialogs, or tools you cannot clearly see.
- If the screenshot shows only a webcam, a photo, a desktop, or no real application screen, reply SKIP.`

// ── Constrained JSON output ──
// JSON schema for one procedure step. Passed to engines that support constrained
// decoding (Ollama `format`, llama-server `response_format`, WebLLM `schema`) so
// the sampler CANNOT produce malformed output — no chatty preamble, no missing
// fields, no format drift. The old TITLE:/STEPS: text parsing stays as fallback
// for engines or models where the schema isn't honoured.
// "screen" comes FIRST on purpose: filling it forces the model to OBSERVE the
// screenshot/OCR before deciding skip — without it, small models anchor on the
// (usually vague) meeting chatter and skip windows where the screen clearly
// shows real work. Proven on gemma3:4b: same vague transcript flipped from
// skip:true to a correct documented step once "screen" led the object.
export const STEP_JSON_SCHEMA = {
  type: "object",
  properties: {
    screen: { type: "string" },
    skip: { type: "boolean" },
    title: { type: "string" },
    steps: { type: "array", items: { type: "string" }, maxItems: 6 },
    result: { type: "string" },
    note: { type: "string" },
  },
  required: ["screen", "skip", "title", "steps", "result", "note"],
}

// Appended LAST to the system prompt when constrained decoding is active, so the
// model knows the output contract matches the grammar the sampler enforces.
export const JSON_ADDENDUM = `

OUTPUT FORMAT — reply with a SINGLE JSON object and nothing else. Work in TWO stages:
STAGE 1 — fill "screen" with what the screenshot / on-screen text concretely shows: which window, dialog, panel, or menu is open and what is selected or configured. Only what you can actually see.
STAGE 2 — THEN decide. If the screen shows a concrete UI state or an action in progress (an open dialog, a selection, a configuration), document it as a step — even if the speech around it is vague chatter; people talk casually while doing concrete work. Set "skip": true ONLY if the screen shows no real application activity AND the speech contains no action.
{"screen": "<what is visibly happening on screen>", "skip": false, "title": "<short phase title, max 8 words>", "steps": ["<action 1>", "<action 2>"], "result": "<one sentence>", "note": "<one tip/warning, or empty string>"}
If there is truly no followable action (small talk only, webcam-only, pause), reply:
{"screen": "<what is shown>", "skip": true, "title": "", "steps": [], "result": "", "note": ""}`

// Tidy a step line: drop leading discourse markers, first-person speech and filler
// so verbatim narration ("Let me move this table just a little bit…") reads like a
// clean imperative instruction. Conservative — it never changes the actual action.
function tidyLine(s) {
  if (typeof s !== "string") return s
  let out = s
    .replace(/^\s*(okay|ok|so|now|then|alright|well|um+|uh+|yeah)[,!.\s]+/i, "")
    .replace(/\b(let me|i'?ll|i will|i'?m going to|i am going to|we'?ll|we will|we'?re going to|let'?s)\s+/gi, "")
    .replace(/\b(just|a little bit|a bit|kind of|sort of|you know|basically|actually|maybe)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .trim()
  return out ? out[0].toUpperCase() + out.slice(1) : out
}

// A NOTE that just narrates what the step already does ("This step opens the
// dashboard", "The user is navigating…") adds nothing for the reader and clutters
// Key Observations. Drop these so only genuine tips / warnings / insights remain.
export function isFillerNote(note) {
  const n = (note || "").trim()
  if (!n) return true
  if (n.split(/\s+/).length < 3) return true
  return /^(this (step|action|process|part|view|screen)|the (initial|primary|first|main|next|final) (action|step)|the user (is|then|will|now|has|navigates)|it (then |simply |essentially )?(initiates|expands|confirms|establishes|focuses|opens|navigates|displays|shows|allows|enables|begins|starts))\b/i.test(n)
}

// Remove the model's self-referential meta-commentary that sometimes leaks into a
// step (e.g. a trailing "(Note: The draft step does not invent…)"). Keeps real text.
function stripMeta(s) {
  if (typeof s !== "string") return s
  return s
    .replace(/\([^()]*\b(?:draft step|corrected step|revised step|the evidence|OCR text|on-screen text)\b[^()]*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// OCR sometimes misreads a technical ID half-right ("RL_CO_AM_CCrownnerDashboard_CC")
// and the model copies it into a step or result verbatim. A half-garbled ID is
// worse than none — the reader can't use it and it looks broken. Strip long
// underscore-chained tokens; short real codes (t-codes, "FI_MD") survive.
function stripGarbledIds(s) {
  if (typeof s !== "string") return s
  return s
    .replace(/\b[A-Za-z0-9]+(?:_[A-Za-z0-9]+){2,}\b/g, (m) => (m.length >= 18 ? "" : m))
    .replace(/["'(]\s*["')]/g, "")   // empty quotes/parens left behind
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim()
}

// Clean one field through the full pipeline (meta commentary, garbled IDs).
function cleanField(s) { return stripMeta(stripGarbledIds(typeof s === "string" ? s : "")) }

// JSON-first parse: with constrained decoding the reply IS this object. Returns
// null (not skip) when no JSON is found so the text parser can try instead.
function tryParseStepJSON(t) {
  const m = t.match(/\{[\s\S]*\}/)
  if (!m) return null
  let o
  try { o = JSON.parse(m[0]) } catch { return null }
  if (!o || typeof o !== "object" || Array.isArray(o)) return null
  if (!("skip" in o) && !("title" in o) && !("steps" in o)) return null
  if (o.skip === true) return { skip: true }
  const steps = (Array.isArray(o.steps) ? o.steps : [])
    .filter((s) => typeof s === "string")
    .map((s) => tidyLine(cleanField(s)))
    .filter((s) => s.length > 2)
  const title = cleanField(o.title).replace(/["'.]+$/, "").trim()
  const result = cleanField(o.result)
  let note = cleanField(o.note)
  if (note.length < 3 || /^(none|n\/a|na|-)$/i.test(note) || isFillerNote(note)) note = ""
  if (!steps.length && !title) return { skip: true }
  return { skip: false, title, steps, result, note }
}

// Parse a procedure-step reply → { skip } or { title, steps[], result, note }.
export function parseProcedureStep(text) {
  if (!text) return { skip: true }
  const t = text.trim()
  const fromJSON = tryParseStepJSON(t)
  if (fromJSON) return fromJSON
  if (/^SKIP\b/i.test(t) && t.length < 24) return { skip: true }
  const title = (t.match(/TITLE:\s*(.+)/i)?.[1] || '').trim()
  const stepsBlock = t.match(/STEPS?:\s*([\s\S]*?)(?=\n\s*RESULT:|\n\s*NOTE:|$)/i)?.[1] || ''
  const steps = stepsBlock
    .split('\n')
    .map((l) => l.replace(/^[\d\-\*•]+[.\):\s]+/, '').trim())
    .filter((l) => l.length > 2)
  const result = cleanField((t.match(/RESULT:\s*([\s\S]*?)(?=\n\s*NOTE:|$)/i)?.[1] || '').trim())
  let note = (t.match(/NOTE:\s*([\s\S]*)$/i)?.[1] || '').trim()
  note = note.replace(/^[\s\-–—•:]+/, '').trim()              // strip leading dash/bullet ("– This opens…")
  note = stripMeta(note)
  // Drop notes that are just the model explaining its own corrections (verifier bloat).
  if (/\b(the )?(draft|corrected|revised|above) (step|note)\b|\bthe evidence (does|provided)\b|\bOCR text\b/i.test(note)) note = ''
  if (note.length < 3 || /^(none|n\/a|na)$/i.test(note) || /^[-–—.\s]*$/.test(note)) note = '' // drop empty / dash-only
  if (isFillerNote(note)) note = '' // drop content-free narration of the step itself
  if (!steps.length && !title) return { skip: true }
  return { skip: false, title: stripGarbledIds(title), steps: steps.map((s) => tidyLine(cleanField(s))).filter((s) => s.length > 2), result, note }
}

// ── Noise gate ──
// Heuristic: is this segment ONLY meeting / audio-video logistics or small talk,
// with no actual procedure in it? Used to drop obvious noise BEFORE it reaches
// the model (saves a call and stops chatter like "mute yourself" or "can you see
// my screen" from becoming steps). Deliberately conservative: it never fires when
// a concrete action verb is present, and the caller additionally requires the
// on-screen text to be empty — so a window that shows real work is never dropped.
const NOISE_PATTERNS = [
  /\b(un)?mute(d)?\b/i, /\bcan you hear me\b/i, /\bi (can'?t|cannot) hear\b/i, /\byou'?re breaking up\b/i,
  /\bcan you see my screen\b/i, /\bsee(ing)? my screen\b/i, /\bshar(e|ing) (my |your )?screen\b/i,
  /\bare you (seeing|there|with me)\b/i, /\byour (video|audio|mic|microphone|camera) (is|seems|froze|cut)\b/i,
  /\b(hello|hi|hey)\b[^.?!]*\b(everyone|guys|team|all)\b/i, /\b(goodbye|bye|see you|talk soon|thanks for joining)\b/i,
  /\b(the )?recording (is|has) (started|begun|on)\b/i, /\blost you\b/i, /\bcan you (still )?(hear|see) me\b/i,
  /\blet me share\b/i, /\bone (sec|second|moment)\b/i,
]
const ACTION_VERBS = /\b(click|open|select|choose|navigate|go to|type|enter|set|create|add|remove|delete|drag|drop|expand|collapse|configure|run|execute|save|export|import|filter|sort|right[- ]?click|double[- ]?click|press|insert|move|rename|copy|paste|apply|refresh|load|build|edit|format|group|sum)\b/i

// ── Sensitive-word scrub ──
// Whisper sometimes MIS-hears words and produces alarming output (e.g. "Hitler"
// for "he, there"). In a professional document — especially for users in Germany
// — that is a reputational/legal risk. We replace these with "[unclear]" at the
// transcript level, so it can never reach the steps, summary, FAQ or export.
// These words are essentially always ASR errors in a business screen-recording.
const SENSITIVE_RE = /\b(hitler|nazis?|heil\s+hitler|f[uü]hrer|third\s+reich|holocaust|gestapo|swastika)\b/gi
export function scrubSensitive(text) {
  if (typeof text !== "string") return text
  return text.replace(SENSITIVE_RE, "[unclear]")
}

export function isMeetingNoise(text) {
  const t = (text || "").trim()
  if (!t) return false                   // no narration → let the OCR/screen path decide
  if (t.length > 240) return false        // long segments almost always carry real content
  if (ACTION_VERBS.test(t)) return false  // any concrete action → not pure noise
  return NOISE_PATTERNS.some((re) => re.test(t))
}

// Does the narration contain a concrete, followable action? Used by the recall
// guard: a skipped window where someone SAID "click / open / configure…" is far
// more likely a model miss than true noise.
export function hasActionWords(text) { return ACTION_VERBS.test(text || "") }

// ── Transcript noise scrub ──
// Sentence-level cleaning applied BEFORE the transcript reaches any prompt.
// Meeting chatter ("can you see my screen"), greetings, non-speech markers and
// Whisper's repetition hallucinations ("Thank you. Thank you. Thank you.") waste
// context and invite fabricated steps. Conservative on purpose: a sentence with
// a real action verb, or any longer sentence, always survives — only short,
// unmistakable chatter is dropped.
export function cleanTranscriptText(text) {
  if (!text) return ""
  const parts = text.split(/(?<=[.?!])\s+/)
  const out = []
  let prevNorm = ""
  for (const p of parts) {
    const s = p.trim()
    if (!s) continue
    const norm = s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim()
    if (norm && norm === prevNorm) continue            // consecutive repeat → ASR hallucination
    prevNorm = norm
    if (/^\[[^\]]*\]$|^\([^)]*\)$/.test(s)) continue   // [music], (laughs), [inaudible]
    if (/^(um+|uh+|hmm+|mm-?hmm|okay|ok|yeah|yes|no|right|so|thank you|thanks)[.!?]?$/i.test(norm)) continue
    if (!ACTION_VERBS.test(s) && s.split(/\s+/).length <= 12 && NOISE_PATTERNS.some((re) => re.test(s))) continue
    out.push(s)
  }
  return out.join(" ")
}

// ── Recall guard (second look) ──
// Appended to the system prompt when re-running a window the model skipped even
// though the evidence looked real. Counters the skip-happy bias the strict
// grounding rules create — a short accurate doc is good, a doc with a missing
// step someone needed is not.
export const RECALL_ADDENDUM = `

SECOND LOOK: this segment was flagged as likely containing a real action (action words were spoken, or the screen shows a busy application). Re-examine the evidence carefully — especially the SCREENSHOT: an open dialog, menu, panel, or selection on screen is a documentable action even if the speech around it is vague. Only reply with "skip": true if you are CERTAIN no followable action happened; otherwise document the action you find, however small.`

// ── Intelligent app identification (no hardcoded app list) ──
// One LLM pass looks at the actual screen (the richest OCR text + a screenshot)
// and NAMES the application itself — works for ANY app/website, nothing hardcoded.
// The result is injected into every annotation prompt so the model never guesses
// the software per-segment (the root cause of "In Excel…" when it's really SAC).
export const IDENTIFY_APP_PROMPT = `You are shown the on-screen text (OCR), and possibly a screenshot, of a software application or website.

Identify the application. Use strong signals: the URL in the address bar, the browser tab / window title, product names, distinctive menus and layout.

Reply with ONLY the product name on a single line — for example: "SAP Analytics Cloud", "Microsoft Excel", "Figma", "Salesforce". Do not explain. If you genuinely cannot tell, reply exactly: Unknown`

// Clean the identifier's reply into a usable app name (or "" if unknown).
export function parseAppName(text) {
  let s = (text || "").split("\n")[0].replace(/^[^A-Za-z0-9]+/, "").trim()
  s = s.replace(/^(the )?(application|app|software|website|tool|product)\s+(is|shown|here)?:?\s*/i, "").trim()
  s = s.replace(/["'.]+$/, "").trim()
  if (!s || /^unknown$/i.test(s) || s.length > 48) return ""
  return s
}

// Prepended to the system prompt so EVERY window is anchored to the real app —
// the model can no longer guess the software per-segment.
export function appContextPrefix(appName) {
  return appName
    ? `CONTEXT — READ FIRST: The application in this entire recording is **${appName}**. EVERY step is inside ${appName}. Refer to it ONLY as "${appName}". You must NOT name any other product — not Salesforce, Excel, Power BI, Word, SAP BW, etc. — unless that exact name literally appears in the on-screen text of THIS segment. Guessing a different app is a serious error.\n\n`
    : ""
}

// ── Logistics / non-procedure step filter ──
// Even when a screen is visible, the model sometimes turns meeting logistics
// ("Mute Microsoft Teams Call") or webcam name tiles ("Access Bajaj Profile",
// "Spot Meeting Attendees", "Find Goss's Finance Info") into steps. These are
// never part of the documented procedure — drop them after the fact.
const LOGISTICS_TITLE = /\b(mute|unmute|microphone|teams call|zoom call|webcam|camera|join(ing)? the (call|meeting)|meeting attendees?|participants?|spot (meeting )?attendees|share (your |the )?screen)\b/i
const PERSON_STEP = /^(access|open|find|locate|spot|view|select|identify)\s+[A-Z][a-z]+('s)?\s+(profile|finance|info|information|details|entry|name)/i
export function isLogisticsStep(step) {
  if (!step) return false
  const t = (step.title || "").trim()
  if (!t) return false
  if (LOGISTICS_TITLE.test(t)) return true
  if (PERSON_STEP.test(t)) return true
  return false
}

// ── Self-verify pass ──
// A drafted step is re-checked against the SAME evidence (transcript + on-screen
// OCR text + screenshot). The model acts as a strict fact-checker: it removes or
// corrects anything the evidence does not support, then re-emits the step in the
// same format (or SKIP if nothing real survives). This is the single biggest
// guard against the model inventing apps, buttons, tools, or values.
export const VERIFY_PROMPT = `You are a strict fact-checker for procedure documentation. You are given a DRAFT step and the EVIDENCE it must be based on (the spoken transcript, the on-screen OCR text, and possibly a screenshot of that moment).

Correct the draft so EVERY claim is supported by the evidence:
- Remove or rewrite any action, application name, menu, button, tab, field, value, dialog, or tool that is NOT present in the evidence.
- CHECK EVERY NAME: for each window, view, tab, row, or query the draft names, find that exact name in the screenshot or OCR text. Not findable → replace it with the name that IS visible (read the window/page title) or a generic phrase. Small models often substitute a plausible module name ("Business Warehouse Query") for what the screen really shows ("Data Analyzer") — this is the #1 error to catch.
- If the draft names software (e.g. "Excel", "Power BI", "Power Query") that the evidence does not actually show, remove that name or replace it with a generic phrase ("the application", "the report").
- Remove any step that uses a person's name as a value/search term, or that invents a feature/dialog not in the evidence.
- Keep the wording concrete and followable, and keep the original order. Do NOT add new actions that are not in the evidence.

Output the corrected step in EXACTLY this format:
TITLE: <short title, max 8 words>
STEPS:
1. <supported action>
2. <next, if any>
RESULT: <one sentence>
NOTE: <one tip/warning, or "-">

Output ONLY the clean corrected step. Do NOT explain what you changed, do NOT add commentary,
and NEVER mention "the draft", "the evidence", "the OCR text", "the corrected step", or what was
removed — the reader only wants the final, usable step.

If, after removing everything unsupported, no real followable action remains, output EXACTLY:
SKIP`

// Assemble the fact-checker's user message: the evidence first, then the draft.
export function buildVerifyPrompt(draft, evidence) {
  return `EVIDENCE (the ONLY things you may rely on):
${evidence}

DRAFT STEP TO CHECK:
${draft}`
}

// ── Consolidation pass ──
// After every step is written, tidy the section TITLES across the whole
// procedure so it reads as one coherent SOP (no transcript fragments, no
// first-person speech, consistent imperative phrasing). Strictly 1 title per
// step, same order/count — the caller falls back to the originals on any mismatch.
export const CONSOLIDATE_TITLE_PROMPT = `You are tidying the section titles of a step-by-step Desktop Procedure so the whole document reads cleanly and consistently.
You are given a numbered list of steps, each with its current title and its first action.

Rewrite EACH title to be a short, imperative phase title (max 8 words) that accurately reflects that step — e.g. "Open the BW analysis", "Set the semantic tag to Group".

Rules:
- Output EXACTLY one rewritten title per input line, in the SAME order, numbered the same way (1., 2., 3., …).
- Do NOT merge, drop, add, or reorder steps. Same number of lines in, same number out.
- Base each title ONLY on the given title/action — do NOT invent new tools, apps, or content.
- No transcript fragments, no first-person speech ("I", "we", "let me"), no trailing punctuation.`

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
