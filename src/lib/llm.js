// Shared local-LLM calls (Ollama + WebLLM) used by both annotation and RAG chat.
// Everything runs locally / in-browser — no servers, no API keys.

let webllmEngine = null
let webllmModel = null

// Curated in-browser models the user can pick from (all valid MLC prebuilt IDs).
// Ordered lightest → heaviest; the array order is also the load-fallback order.
export const WEBLLM_MODELS = [
  {
    id: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
    label: "Fast", params: "1B", size: "~0.9 GB",
    accuracy: "Good", speed: "Fastest", time: "10 to 30s",
    note: "Best for laptops with Intel / integrated graphics and 8 GB RAM. Recommended for most users.",
  },
  {
    id: "Qwen2.5-1.5B-Instruct-q4f32_1-MLC",
    label: "Balanced", params: "1.5B", size: "~1.3 GB",
    accuracy: "Better", speed: "Medium", time: "20 to 50s",
    note: "A good mix of detail and speed. Wants a slightly stronger GPU.",
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f32_1-MLC",
    label: "Quality", params: "3B", size: "~2.2 GB",
    accuracy: "Best", speed: "Slow", time: "40s to 2m",
    note: "Most detailed steps. Best on a dedicated GPU (NVIDIA) with 16 GB RAM.",
  },
]

export const DEFAULT_WEBLLM_MODEL = WEBLLM_MODELS[0].id

export function webLLMLabel(id) {
  return WEBLLM_MODELS.find((m) => m.id === id)?.label ?? "WebLLM"
}

// Turn the raw WebLLM init text into a friendly phase + label so the UI can
// show distinct, moving steps (download → load into GPU → compile → ready)
// instead of one frozen "Finish loading on WebGPU" line.
function webllmPhase(text) {
  const t = (text || "").toLowerCase()
  if (t.includes("finish") || t.includes("ready"))
    return { phase: "ready", label: "Model ready on WebGPU" }
  if (t.includes("shader") || t.includes("compil"))
    return { phase: "compile", label: "Compiling GPU shaders" }
  if (t.includes("fetch") || t.includes("download") || t.includes("param cache"))
    return { phase: "download", label: "Downloading model to your browser cache" }
  if (t.includes("cache") || t.includes("loading model"))
    return { phase: "load", label: "Loading model into the GPU" }
  return { phase: "init", label: text || "Preparing model..." }
}

export function cleanLLMOutput(text) {
  if (!text) return ""
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^[\*\-\s]+(?=\S)/m, '')
    .replace(/\bNow,?\s+I'?ll\b.*?[\n]/gi, '')
    .replace(/\bLet me\s+(?:now\s+)?(?:make sure|ensure|note|outline|describe|summarize)\b.*?[\n]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function callOllama(userMsg, systemPrompt, model = "llama3.2", opts = {}) {
  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: `${systemPrompt}\n\n${userMsg}`,
      stream: false,
      options: { temperature: opts.temperature ?? 0.2, num_predict: opts.maxTokens ?? 512 },
    }),
  })
  if (!res.ok) throw new Error("Ollama not reachable — is it running on localhost:11434?")
  const data = await res.json()
  return cleanLLMOutput(data.response || "")
}

// onStatus is called as (label, pct, phase) so the UI can render distinct
// loading steps. preferredModel is the user's pick; on failure we fall back
// through the lighter models so a weak GPU still ends up with something.
export async function ensureWebLLM(onStatus, preferredModel) {
  if (webllmEngine) {
    onStatus?.("Model ready on WebGPU", 100, "ready") // already cached this session
    return webllmEngine
  }
  const { CreateMLCEngine } = await import("@mlc-ai/web-llm")
  const ids = WEBLLM_MODELS.map((m) => m.id)
  const order = preferredModel ? [preferredModel, ...ids.filter((id) => id !== preferredModel)] : ids
  const tried = new Set()
  let lastErr = null
  for (const m of order) {
    if (tried.has(m)) continue
    tried.add(m)
    try {
      onStatus?.(`Preparing ${webLLMLabel(m)} model...`, 0, "init")
      webllmEngine = await CreateMLCEngine(m, {
        initProgressCallback: (p) => {
          const { phase, label } = webllmPhase(p.text)
          onStatus?.(label, Math.round((p.progress ?? 0) * 100), phase)
        },
      })
      webllmModel = m
      return webllmEngine
    } catch (e) { lastErr = e }
  }
  throw lastErr ?? new Error("WebLLM failed to load")
}

export async function callWebLLM(userMsg, systemPrompt, onStatus, opts = {}) {
  const engine = await ensureWebLLM(onStatus, opts.model)
  const result = await engine.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMsg },
    ],
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 512,
  })
  return cleanLLMOutput(result.choices[0].message.content || "")
}

export function getWebLLMModel() { return webllmModel }
