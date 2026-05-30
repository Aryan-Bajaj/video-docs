import { useCallback } from "react"
import { SKILL_PROMPT, buildSectionsPrompt, buildContextPrompt, parseSectionedAnnotation } from "../lib/skillPrompt"

let webllmEngine = null

// Strip DeepSeek R1 <think>...</think> blocks and other common LLM artifacts
function cleanLLMOutput(text) {
  if (!text) return ""
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')   // DeepSeek R1 reasoning blocks
    .replace(/^[\*\-\s]+(?=\S)/m, '')            // leading ** or -- artifacts
    .replace(/\bNow,?\s+I'?ll\b.*?[\n]/gi, '')   // "Now I'll make sure..." meta-commentary
    .replace(/\bLet me\s+(?:now\s+)?(?:make sure|ensure|note|outline|describe|summarize)\b.*?[\n]/gi, '')
    .replace(/\n{3,}/g, '\n\n')                  // collapse excessive newlines
    .trim()
}

async function callOllama(userMsg, prompt, model = "llama3.2") {
  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: `${prompt}\n\n${userMsg}`,
      stream: false,
    }),
  })
  if (!res.ok) throw new Error("Ollama not reachable — is it running on localhost:11434?")
  const data = await res.json()
  return cleanLLMOutput(data.response || "")
}

async function callWebLLM(userMsg, prompt, onStatus) {
  if (!webllmEngine) {
    const { CreateMLCEngine } = await import("@mlc-ai/web-llm")
    onStatus?.("Initializing WebLLM (first run downloads ~1GB)...")
    webllmEngine = await CreateMLCEngine("Llama-3.2-1B-Instruct-q4f32_1-MLC", {
      initProgressCallback: (p) => onStatus?.(p.text ?? "Loading model..."),
    })
  }
  const result = await webllmEngine.chat.completions.create({
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: userMsg },
    ],
    max_tokens: 300,
  })
  return cleanLLMOutput(result.choices[0].message.content || "")
}

function nearestFrame(frames, timestamp) {
  if (!frames?.length) return null
  return frames.reduce((best, f) =>
    Math.abs(f.timestamp - timestamp) < Math.abs(best.timestamp - timestamp) ? f : best
  , frames[0])
}

function formatTS(secs) {
  if (!secs && secs !== 0) return "00:00"
  return `${Math.floor(secs / 60).toString().padStart(2, "0")}:${Math.floor(secs % 60).toString().padStart(2, "0")}`
}

export default function useAnnotator() {
  const annotate = useCallback(async (chunks, frames, aiMode, onProgress, onStatus, sections, ollamaModel) => {
    const results = []
    const meaningful = chunks.filter(c => c.text?.trim().length > 8)
    const prompt = sections?.length ? buildSectionsPrompt(sections) : SKILL_PROMPT

    for (let i = 0; i < meaningful.length; i++) {
      const chunk = meaningful[i]
      const ts = chunk.timestamp?.[0] ?? 0
      const label = formatTS(ts)
      const frame = nearestFrame(frames, ts)
      const prevText = meaningful[i - 1]?.text ?? null
      const nextText = meaningful[i + 1]?.text ?? null
      const userMsg = buildContextPrompt(chunk.text, label, prevText, nextText)

      onProgress?.(i, meaningful.length)

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
        // annotation stays null — shown as transcript-only
      }

      results.push({
        timestamp: ts,
        endTimestamp: chunk.timestamp?.[1] ?? ts + 5,
        label,
        text: chunk.text,
        frame: frame?.imageData ?? null,
        annotation,
        sectionedAnnotation,
      })
    }

    return results
  }, [])

  return { annotate }
}
