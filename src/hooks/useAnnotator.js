import { useCallback } from "react"
import {
  PROCEDURE_PROMPT, VISION_ADDENDUM, buildContextPrompt, parseProcedureStep,
} from "../lib/skillPrompt"
import { callOllama, callWebLLM } from "../lib/llm"
import { ocrNear } from "./useOCR"

// Pick the screenshot for a window that most likely shows the APPLICATION (the
// frame whose OCR captured the most text), not a webcam / photo / desktop.
function pickFrame(frames, ocrFrameTexts, a, b, center) {
  let bestTs = null, bestLen = 0
  for (const f of ocrFrameTexts || []) {
    if (f.timestamp >= a && f.timestamp < b) {
      const len = (f.text || "").length
      if (len > bestLen) { bestLen = len; bestTs = f.timestamp }
    }
  }
  return nearestFrame(frames, bestTs ?? center)
}

// Flatten a parsed procedure step back into plain text — used by the doc chat /
// RAG so it can still search the procedure content.
function stepToText(step) {
  if (!step) return ""
  return [
    step.title,
    ...(step.steps || []).map((s, i) => `${i + 1}. ${s}`),
    step.result ? `Result: ${step.result}` : "",
    step.note ? `Note: ${step.note}` : "",
  ].filter(Boolean).join("\n")
}

function formatTS(secs) {
  if (!secs && secs !== 0) return "00:00"
  return `${Math.floor(secs / 60).toString().padStart(2, "0")}:${Math.floor(secs % 60).toString().padStart(2, "0")}`
}

function nearestFrame(frames, timestamp) {
  if (!frames?.length) return null
  return frames.reduce((best, f) =>
    Math.abs(f.timestamp - timestamp) < Math.abs(best.timestamp - timestamp) ? f : best
  , frames[0])
}

export default function useAnnotator() {
  // ocrFrameTexts: [{timestamp, text}] from useOCR — gives the model real on-screen UI text.
  const annotate = useCallback(async (
    chunks, frames, aiMode, onProgress, onStatus, sections, ollamaModel, ocrFrameTexts = [],
    shouldCancel = () => false, useVision = false,
  ) => {
    // Build windows across the WHOLE video timeline (not just where someone spoke),
    // so silent stretches are still documented from the on-screen (OCR) text.
    const lastChunk = chunks?.length ? (chunks[chunks.length - 1].timestamp?.[1] ?? chunks[chunks.length - 1].timestamp?.[0] ?? 0) : 0
    const lastFrame = frames?.length ? frames[frames.length - 1].timestamp : 0
    const maxT = Math.max(lastChunk, lastFrame, 1)
    // Window size: finer than before so a long video is fully covered (a 1hr
    // recording → ~40 windows → ~30-35 steps after dedup), while dedup +
    // anti-repeat + vision keep overlapping/garbled steps out. ~90s cap.
    const step = Math.min(90, Math.max(40, maxT / 40))
    const windows = []
    for (let t = 0; t < maxT - 1; t += step) {
      const a = t, b = Math.min(t + step, maxT)
      const center = a + (b - a) / 2
      const text = (chunks || [])
        .filter((c) => { const s = c.timestamp?.[0] ?? 0; return s >= a && s < b })
        .map((c) => c.text.trim()).join(' ').trim()
      const ocr = ocrNear(ocrFrameTexts, center, step)
      if (!text && !ocr) continue // truly blank window
      windows.push({ a, b, center, text, ocr })
    }

    const results = []
    let lastError = null
    let okCount = 0

    // With vision, the model SEES the screen, so the (often garbled) OCR text is
    // dropped from the prompt and the vision instructions are added.
    const prompt = useVision ? PROCEDURE_PROMPT + VISION_ADDENDUM : PROCEDURE_PROMPT

    for (let i = 0; i < windows.length; i++) {
      if (shouldCancel()) break // user cancelled — keep what we have so far
      const win = windows[i]
      const label = formatTS(win.a)
      const frame = pickFrame(frames, ocrFrameTexts, win.a, win.b, win.center)
      const prevText = windows[i - 1]?.text ?? null
      const nextText = windows[i + 1]?.text ?? null
      const userMsg = buildContextPrompt(win.text, label, prevText, nextText, useVision ? null : win.ocr)

      onProgress?.(i, windows.length)

      // Vision: give the model the actual screenshot so it SEES the screen
      // instead of relying only on (sometimes garbled) OCR text.
      const images = useVision && frame?.imageData ? [frame.imageData] : undefined

      let raw = null
      try {
        raw = aiMode === "ollama"
          ? await callOllama(userMsg, prompt, ollamaModel, { images })
          : await callWebLLM(userMsg, prompt, onStatus, { model: ollamaModel, images })
        okCount++
      } catch (e) {
        lastError = e // remember it; surfaced below if nothing succeeds
        continue
      }

      const step = parseProcedureStep(raw)
      if (step.skip) continue // off-topic / silent / no real action → drop from procedure

      results.push({
        timestamp: win.a,
        endTimestamp: win.b,
        label,
        step,                       // { title, steps[], result, note }
        annotation: stepToText(step), // plain text for doc chat / RAG
        text: win.text || step.title || "",
        frame: frame?.imageData ?? null,
        ocrText: win.ocr || null,
      })
    }

    // If every window errored (wrong Ollama model, WebLLM couldn't load), surface
    // the real error instead of silently returning an empty procedure.
    if (windows.length && okCount === 0 && lastError) {
      throw new Error(`Annotation failed: ${lastError.message}. Check the selected model is installed (Ollama) or try WebLLM.`)
    }

    return mergeDuplicateSteps(results)
  }, [])

  return { annotate }
}

// Merge consecutive steps that describe the same action (identical or one title
// contained in the other). Collapses runs like "Open BW" / "Open the BW
// Application" into a single step, keeping the first screenshot and combining
// the unique actions. Big readability win on long recordings.
function normTitle(t) {
  return (t || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim()
}
function mergeInto(target, r) {
  const seen = new Set((target.step.steps || []).map((s) => s.toLowerCase().trim()))
  for (const s of r.step.steps || []) {
    const k = s.toLowerCase().trim()
    if (!seen.has(k)) { target.step.steps.push(s); seen.add(k) }
  }
  if (r.step.result) target.step.result = r.step.result
  if (r.step.note && !target.step.note) target.step.note = r.step.note
  if ((r.step.title || "").length > (target.step.title || "").length) target.step.title = r.step.title
  target.endTimestamp = r.endTimestamp
  target.annotation = stepToText(target.step)
}
function mergeDuplicateSteps(results) {
  const out = []
  const seenTitles = new Map() // exact normalized title -> index in out
  for (const r of results) {
    const b = normTitle(r?.step?.title)
    const prev = out[out.length - 1]
    const a = normTitle(prev?.step?.title)
    // 1) consecutive near-duplicate (exact OR one title contains the other)
    if (prev && a && b && (a === b || (a.length > 6 && b.length > 6 && (a.includes(b) || b.includes(a))))) {
      mergeInto(prev, r); continue
    }
    // 2) exact-title duplicate seen earlier anywhere → fold into that step
    if (b && seenTitles.has(b)) { mergeInto(out[seenTitles.get(b)], r); continue }
    seenTitles.set(b, out.length)
    out.push(r)
  }
  return out
}
