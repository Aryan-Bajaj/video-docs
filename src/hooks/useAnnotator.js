import { useCallback } from "react"
import {
  SKILL_PROMPT, buildSectionsPrompt, buildContextPrompt,
  parseSectionedAnnotation, groupIntoWindows,
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
    // Chunk the transcript into ~45s windows so long videos stay coherent and fast.
    const windows = groupIntoWindows(chunks, 45)
    const prompt = sections?.length ? buildSectionsPrompt(sections) : SKILL_PROMPT
    const results = []

    for (let i = 0; i < windows.length; i++) {
      const win = windows[i]
      const ts = win.timestamp[0]
      const label = formatTS(ts)
      const frame = nearestFrame(frames, ts)
      const ocrText = ocrNear(ocrFrameTexts, ts)
      const prevText = windows[i - 1]?.text ?? null
      const nextText = windows[i + 1]?.text ?? null
      const userMsg = buildContextPrompt(win.text, label, prevText, nextText, ocrText)

      onProgress?.(i, windows.length)

      let annotation = null
      let sectionedAnnotation = null
      try {
        annotation = aiMode === "ollama"
          ? await callOllama(userMsg, prompt, ollamaModel)
          : await callWebLLM(userMsg, prompt, onStatus)
        if (sections?.length && annotation) {
          sectionedAnnotation = parseSectionedAnnotation(annotation, sections)
        }
      } catch {
        // leave null — shown as transcript-only
      }

      results.push({
        timestamp: ts,
        endTimestamp: win.timestamp[1],
        label,
        text: win.text,
        frame: frame?.imageData ?? null,
        ocrText: ocrText || null,
        annotation,
        sectionedAnnotation,
      })
    }

    return results
  }, [])

  return { annotate }
}
