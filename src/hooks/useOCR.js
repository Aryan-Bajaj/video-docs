import { useCallback } from "react"

// Known apps / tools we can recognise from on-screen text (OCR) or transcript.
// canonical name -> regex of telltale strings that appear in the UI.
const TOOL_SIGNATURES = [
  ["Microsoft Excel", /\bexcel\b|\.xls[xm]?\b|formula bar|=sum\(|sheet\d|workbook/i],
  ["VBA / Macros", /\bvba\b|visual basic|alt\s*\+\s*f11|\.bas\b|macro|sub\s+\w+\(\)|end sub/i],
  ["Microsoft Word", /microsoft word|\.docx?\b/i],
  ["PowerPoint", /powerpoint|\.pptx?\b|slide \d/i],
  ["SAP", /\bsap\b|s4hana|s\/4hana|\bt-code\b/i],
  ["VS Code", /visual studio code|vs code/i],
  ["Visual Studio", /visual studio(?! code)/i],
  ["Terminal / CLI", /\$\s|>\s*npm|command prompt|powershell|bash|terminal/i],
  ["Chrome", /google chrome|chrome:\/\//i],
  ["Figma", /\bfigma\b/i],
  ["Photoshop", /photoshop|\.psd\b/i],
  ["Notion", /\bnotion\b/i],
  ["Python", /\bpython\b|\.py\b|import \w+|def \w+\(/i],
  ["GitHub", /github\.com|git push|git commit|pull request/i],
  ["Jira", /\bjira\b/i],
  ["Salesforce", /salesforce|lightning experience/i],
  ["Tableau", /\btableau\b/i],
  ["Power BI", /power bi/i],
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

export default function useOCR() {
  // frames: [{timestamp, imageData}], transcriptText: string (for extra tool hints)
  const runOCR = useCallback(async (frames, transcriptText = "", onProgress) => {
    if (!frames?.length) return { frameTexts: [], tools: detectTools(transcriptText) }

    const { createWorker } = await import("tesseract.js")
    const worker = await createWorker("eng")

    const sample = sampleFrames(frames, 40)
    const frameTexts = []
    let combined = transcriptText + "\n"

    for (let i = 0; i < sample.length; i++) {
      onProgress?.(i, sample.length)
      try {
        const { data } = await worker.recognize(sample[i].imageData)
        const text = (data.text || "").replace(/\s+\n/g, "\n").trim()
        if (text) {
          frameTexts.push({ timestamp: sample[i].timestamp, text })
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
