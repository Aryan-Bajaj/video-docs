import { useCallback } from "react"

// Known apps / tools we can recognise from on-screen text (OCR) or transcript.
// canonical name -> regex of telltale strings that appear in the UI.
const TOOL_SIGNATURES = [
  ["Microsoft Excel", /\bexcel\b|\.xls[xm]?\b|formula bar|=sum\(|sheet\d|workbook/i],
  ["VBA / Macros", /\bvba\b|visual basic|alt\s*\+\s*f11|\.bas\b|macro|sub\s+\w+\(\)|end sub/i],
  ["Microsoft Word", /microsoft word|\.docx?\b/i],
  ["PowerPoint", /powerpoint|\.pptx?\b|slide \d/i],
  ["SAP", /\bsap\b|s4hana|s\/4hana|\bt-code\b|sap ibp|analytics cloud/i],
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
  return [...new Set(found)]
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

async function selectKeyframes(frames, maxKeyframes = 72) {
  if (!frames?.length) return []
  if (frames.length <= maxKeyframes) return frames

  // Bound the fingerprinting work on very long videos.
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
  const MIN_COVERAGE = 24      // always keep at least this many, even if static
  const chosen = new Set([0])  // first frame is always a keyframe
  const byChange = cands.map((_, i) => i).filter((i) => i > 0).sort((a, b) => diffs[b] - diffs[a])

  for (const i of byChange) { if (chosen.size >= maxKeyframes) break; if (diffs[i] >= THRESHOLD) chosen.add(i) }
  for (const i of byChange) { if (chosen.size >= Math.min(maxKeyframes, MIN_COVERAGE)) break; chosen.add(i) }

  return [...chosen].sort((a, b) => a - b).map((i) => cands[i])
}

export default function useOCR() {
  // frames: [{timestamp, imageData}], transcriptText: string (for extra tool hints)
  const runOCR = useCallback(async (frames, transcriptText = "", onProgress) => {
    if (!frames?.length) return { frameTexts: [], tools: detectTools(transcriptText) }

    const { createWorker } = await import("tesseract.js")
    const worker = await createWorker("eng")
    // Keep spacing between words/columns — helps read tables, ribbons and menus.
    try { await worker.setParameters({ preserve_interword_spaces: "1" }) } catch { /* older tesseract.js */ }

    const keyframes = await selectKeyframes(frames)
    const frameTexts = []
    let combined = transcriptText + "\n"

    for (let i = 0; i < keyframes.length; i++) {
      onProgress?.(i, keyframes.length)
      try {
        const { data } = await worker.recognize(keyframes[i].imageData)
        const text = (data.text || "").replace(/\s+\n/g, "\n").trim()
        if (text) {
          frameTexts.push({ timestamp: keyframes[i].timestamp, text })
          combined += text + "\n"
        }
      } catch {
        // skip unreadable frame
      }
    }

    await worker.terminate()
    return { frameTexts, tools: detectTools(combined) }
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
