import { useCallback } from "react"
import {
  SKILL_PROMPT, buildSectionsPrompt, buildContextPrompt,
  parseSectionedAnnotation,
} from "../lib/skillPrompt"
import { callOllama, callWebLLM } from "../lib/llm"
import { ocrNear } from "./useOCR"

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
  ) => {
    // Build windows across the WHOLE video timeline (not just where someone spoke),
    // so silent stretches are still documented from the on-screen (OCR) text.
    const lastChunk = chunks?.length ? (chunks[chunks.length - 1].timestamp?.[1] ?? chunks[chunks.length - 1].timestamp?.[0] ?? 0) : 0
    const lastFrame = frames?.length ? frames[frames.length - 1].timestamp : 0
    const maxT = Math.max(lastChunk, lastFrame, 1)
    const step = Math.min(45, Math.max(20, maxT / 18)) // 20–45s windows, ~18 max
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

    const prompt = sections?.length ? buildSectionsPrompt(sections) : SKILL_PROMPT
    const results = []
    let lastError = null

    for (let i = 0; i < windows.length; i++) {
      const win = windows[i]
      const label = formatTS(win.a)
      const frame = nearestFrame(frames, win.center)
      const prevText = windows[i - 1]?.text ?? null
      const nextText = windows[i + 1]?.text ?? null
      const userMsg = buildContextPrompt(win.text, label, prevText, nextText, win.ocr)

      onProgress?.(i, windows.length)

      let annotation = null
      let sectionedAnnotation = null
      try {
        annotation = aiMode === "ollama"
          ? await callOllama(userMsg, prompt, ollamaModel)
          : await callWebLLM(userMsg, prompt, onStatus, { model: ollamaModel })
        if (sections?.length && annotation) {
          sectionedAnnotation = parseSectionedAnnotation(annotation, sections)
        }
      } catch (e) {
        lastError = e // remember it; surfaced below if nothing succeeds
      }

      results.push({
        timestamp: win.a,
        endTimestamp: win.b,
        label,
        text: win.text || (win.ocr ? "(on-screen action)" : ""),
        frame: frame?.imageData ?? null,
        ocrText: win.ocr || null,
        annotation,
        sectionedAnnotation,
      })
    }

    // If every window failed (e.g. wrong Ollama model name, or WebLLM couldn't load),
    // surface the real error instead of silently returning empty docs.
    if (results.length && results.every((r) => !r.annotation) && lastError) {
      throw new Error(`Annotation failed: ${lastError.message}. Check the selected model is installed (Ollama) or try WebLLM.`)
    }

    return results
  }, [])

  return { annotate }
}
