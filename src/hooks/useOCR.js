import { useCallback } from "react"

// Apps used purely to RUN the meeting/recording — never the documented tool.
// Detected for context but excluded from the doc's "tools used" list.
const CONFERENCING = new Set(["Microsoft Teams", "Zoom", "Webex", "Google Meet"])

// Known apps / tools we can recognise from on-screen text (OCR) or transcript.
// canonical name -> regex of telltale strings that appear in the UI. Order matters:
// more specific products (e.g. SAP Analytics Cloud) come BEFORE generic ones (SAP).
const TOOL_SIGNATURES = [
  ["SAP Analytics Cloud", /analytics cloud|hcs\.cloud\.sap|\/fpa\/ui|analytics designer|\bsac\b/i],
  ["Microsoft Excel", /\bexcel\b|\.xls[xm]?\b|formula bar|=sum\(|sheet\d|workbook/i],
  ["VBA / Macros", /\bvba\b|visual basic|alt\s*\+\s*f11|\.bas\b|macro|sub\s+\w+\(\)|end sub/i],
  ["Microsoft Word", /microsoft word|\.docx?\b/i],
  ["PowerPoint", /powerpoint|\.pptx?\b|slide \d/i],
  ["SAP", /\bsap\b|s4hana|s\/4hana|\bt-code\b|sap ibp/i],
  ["VS Code", /visual studio code|vs code/i],
  ["Visual Studio", /visual studio(?! code)/i],
  ["Terminal / CLI", /\$\s|>\s*npm|command prompt|powershell|bash|terminal/i],
  ["Chrome", /google chrome|chrome:\/\//i],
  ["Edge", /microsoft edge\b/i],
  ["Figma", /\bfigma\b/i],
  ["Photoshop", /photoshop|\.psd\b/i],
  ["Notion", /\bnotion\b/i],
  ["Python", /\bpython\b|\.py\b|import \w+|def \w+\(/i],
  ["GitHub", /github\.com|git push|git commit|pull request/i],
  ["Jira", /\bjira\b/i],
  ["Salesforce", /salesforce|lightning experience/i],
  ["Tableau", /\btableau\b/i],
  ["Power BI", /power bi/i],
  ["Microsoft Teams", /microsoft teams|\bteams meeting\b/i],
  ["Zoom", /\bzoom\b.*meeting|zoom\.us/i],
  ["Outlook", /\boutlook\b/i],
  ["Google Sheets", /google sheets|docs\.google\.com\/spreadsheets/i],
  ["Slack", /\bslack\b/i],
  ["SQL / Database", /\bselect\b.*\bfrom\b|\bsql\b|ssms|mysql|postgres/i],
]

export function detectTools(text) {
  const found = []
  for (const [name, re] of TOOL_SIGNATURES) {
    if (re.source !== "(?:)" && re.test(text)) found.push(name)
  }
  let tools = [...new Set(found)]
  // A specific SAP product wins over the generic "SAP" tag.
  if (tools.includes("SAP Analytics Cloud")) tools = tools.filter((t) => t !== "SAP")
  // Drop the conferencing app — it's how the session was recorded, not the tool
  // being documented. (Teams/Zoom showing up was a recurring false positive.)
  return tools.filter((t) => !CONFERENCING.has(t))
}

// The single primary application being documented — the most specific real tool
// found (conferencing excluded). Used to ground every annotation prompt so the
// model never guesses the wrong software (e.g. "Excel" when it's SAC).
export function detectPrimaryApp(text) {
  return detectTools(text)[0] || ""
}

// Sample up to `max` frames evenly so OCR time stays bounded on long videos.
function sampleFrames(frames, max) {
  if (frames.length <= max) return frames
  const step = frames.length / max
  const out = []
  for (let i = 0; i < max; i++) out.push(frames[Math.floor(i * step)])
  return out
}

// ── Scene-change keyframe selection ──
// Instead of blindly sampling every Nth frame, pick the frames where the SCREEN
// ACTUALLY CHANGED. This gives the model "eyes" on each distinct UI state (a new
// dialog, tab, sheet, screen) rather than near-duplicate frames — far better at
// capturing exactly which tools/elements appear, while staying bounded.
function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

async function fingerprint(src, ctx, size = 16) {
  const img = await loadImage(src)
  ctx.clearRect(0, 0, size, size)
  ctx.drawImage(img, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)
  const fp = new Float32Array(size * size)
  for (let i = 0; i < size * size; i++) {
    fp[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
  }
  return fp
}

function fpDiff(a, b) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i])
  return s / a.length
}

// Returns { keyframes, sceneCuts }. sceneCuts = timestamps where the SCREEN
// pixels actually changed hard (new dialog / tab / app / share start) — far more
// robust than OCR-text similarity, which degrades to noise on blurry recordings.
// The annotator uses these as step boundaries so steps align with real events.
// The OCR budget SCALES with video length (one keyframe per ~40s, capped) so a
// 90-minute recording is read as densely per minute as a 20-minute one.
async function selectKeyframes(frames, maxKeyframes = null) {
  if (!frames?.length) return { keyframes: [], sceneCuts: [] }
  if (maxKeyframes == null) {
    const dur = frames[frames.length - 1].timestamp || 0
    maxKeyframes = Math.min(140, Math.max(48, Math.round(dur / 40)))
  }

  // Fingerprint ALWAYS (even when all frames fit the keyframe budget) — the
  // scene cuts matter to segmentation regardless of how many frames we OCR.
  const cands = sampleFrames(frames, Math.min(frames.length, 240))
  const canvas = document.createElement("canvas")
  canvas.width = 16; canvas.height = 16
  const ctx = canvas.getContext("2d", { willReadFrequently: true })

  const fps = []
  for (const f of cands) {
    try { fps.push(await fingerprint(f.imageData, ctx)) } catch { fps.push(null) }
  }
  const diffs = cands.map((_, i) => (i > 0 && fps[i] && fps[i - 1]) ? fpDiff(fps[i], fps[i - 1]) : 0)

  const THRESHOLD = 8          // avg luminance change that counts as a "new screen"
  const sceneCuts = cands.filter((_, i) => diffs[i] >= THRESHOLD).map((f) => f.timestamp)

  if (frames.length <= maxKeyframes) return { keyframes: frames, sceneCuts }

  const MIN_COVERAGE = 24      // always keep at least this many, even if static
  const chosen = new Set([0])  // first frame is always a keyframe
  const byChange = cands.map((_, i) => i).filter((i) => i > 0).sort((a, b) => diffs[b] - diffs[a])

  for (const i of byChange) { if (chosen.size >= maxKeyframes) break; if (diffs[i] >= THRESHOLD) chosen.add(i) }
  for (const i of byChange) { if (chosen.size >= Math.min(maxKeyframes, MIN_COVERAGE)) break; chosen.add(i) }

  return { keyframes: [...chosen].sort((a, b) => a - b).map((i) => cands[i]), sceneCuts }
}

// Webcam tile / participant labels (Teams renders "Lastname, Firstname (ORG-UNIT,
// CODE)" on every tile, in every frame). These names leak into OCR and the model
// then turns them into fake artifacts ("Das Neues Report"). They are NEVER part
// of the documented application — drop any OCR line that looks like one.
const TILE_LABEL = /\([A-Z]{1,4}[-–][A-Z]{2,6}(,\s*[A-Z]{2,8})?\)|^[A-Z][a-zA-Z]+(\s[A-Za-z]+){0,3},\s*[A-Z][a-zA-Z]+/
function isTileLabelLine(line) {
  const l = (line || "").trim()
  if (l.length < 6 || l.length > 80) return false
  return TILE_LABEL.test(l)
}

// Rebuild OCR text keeping only CONFIDENT words, preserving line structure. If a
// frame is mostly low-confidence (garbled, unreadable screen), drop it entirely so
// the model never tries to document noise like "EERNGRIEES". Defensive: falls back
// to the raw text if the structured output isn't available.
function cleanOCR(data, minConf = 55) {
  try {
    const blocks = data?.blocks
    if (Array.isArray(blocks) && blocks.length) {
      const lines = []
      let total = 0, kept = 0
      for (const b of blocks) for (const p of (b.paragraphs || [])) for (const l of (p.lines || [])) {
        const ws = (l.words || []).filter((w) => (w.text || "").trim())
        total += ws.length
        const good = ws.filter((w) => (w.confidence ?? 100) >= minConf)
        kept += good.length
        if (good.length) lines.push(good.map((w) => w.text.trim()).join(" "))
      }
      if (total && kept < total * 0.35) return "" // mostly garbage → drop this frame
      const out = lines.filter((l) => !isTileLabelLine(l)).join("\n").trim()
      if (out) return out
    }
    if (Array.isArray(data?.words) && data.words.length) {
      const kept = data.words.filter((w) => (w.confidence ?? 100) >= minConf && (w.text || "").trim())
      if (kept.length < data.words.length * 0.35) return ""
      return kept.map((w) => w.text.trim()).join(" ")
    }
    return data?.text || ""
  } catch { return data?.text || "" }
}

export default function useOCR() {
  // frames: [{timestamp, imageData}], transcriptText: string (for extra tool hints)
  const runOCR = useCallback(async (frames, transcriptText = "", onProgress) => {
    if (!frames?.length) return { frameTexts: [], tools: detectTools(transcriptText), primaryApp: detectPrimaryApp(transcriptText), sceneCuts: [] }

    const { createWorker } = await import("tesseract.js")
    const worker = await createWorker("eng")
    // Keep spacing between words/columns — helps read tables, ribbons and menus.
    try { await worker.setParameters({ preserve_interword_spaces: "1" }) } catch { /* older tesseract.js */ }

    const { keyframes, sceneCuts } = await selectKeyframes(frames)
    const frameTexts = []
    let combined = transcriptText + "\n"

    for (let i = 0; i < keyframes.length; i++) {
      onProgress?.(i, keyframes.length)
      try {
        // Request word/line confidence so we can drop garbled, low-confidence OCR
        // (e.g. unreadable enterprise-UI text) instead of feeding it to the model.
        const { data } = await worker.recognize(keyframes[i].imageData, {}, { text: true, blocks: true })
        const text = cleanOCR(data).replace(/\s+\n/g, "\n").trim()
        if (text) {
          frameTexts.push({ timestamp: keyframes[i].timestamp, text })
          combined += text + "\n"
        }
      } catch {
        // skip unreadable frame
      }
    }

    await worker.terminate()
    return { frameTexts, tools: detectTools(combined), primaryApp: detectPrimaryApp(combined), sceneCuts }
  }, [])

  return { runOCR, detectTools }
}

// Find the OCR text captured nearest a given timestamp (for annotation context).
export function ocrNear(frameTexts, ts, windowSecs = 8) {
  if (!frameTexts?.length) return ""
  const hits = frameTexts
    .filter((f) => Math.abs(f.timestamp - ts) <= windowSecs)
    .map((f) => f.text)
  return hits.join(" ").slice(0, 400)
}
