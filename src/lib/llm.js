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
    note: "For Intel / integrated graphics and 8 GB RAM. Lightest — runs almost anywhere.",
  },
  {
    id: "Qwen2.5-3B-Instruct-q4f32_1-MLC",
    label: "Balanced", params: "3B", size: "~2.2 GB",
    accuracy: "Strong", speed: "Medium", time: "30s to 1m",
    note: "Best all-round choice for most laptops with a recent or dedicated GPU. Sharper, more accurate steps than the 1B. Recommended.",
  },
  {
    id: "Phi-3.5-mini-instruct-q4f32_1-MLC",
    label: "Quality", params: "3.8B", size: "~2.6 GB",
    accuracy: "Strong+", speed: "Medium-slow", time: "40s to 1.5m",
    note: "Excellent reasoning for detailed procedures. Wants a dedicated NVIDIA GPU.",
  },
  {
    id: "Qwen2.5-7B-Instruct-q4f16_1-MLC",
    label: "Max", params: "7B", size: "~5.5 GB",
    accuracy: "Best", speed: "Slow", time: "1 to 3m",
    note: "Highest quality, closest to a server model. Needs a strong GPU (8 GB+ VRAM, 16 GB RAM). Falls back automatically if it can't load.",
  },
  {
    id: "Phi-3.5-vision-instruct-q4f16_1-MLC",
    label: "Vision", params: "4.2B", size: "~3.5 GB", vision: true,
    accuracy: "Best for screens", speed: "Slow", time: "1 to 3m",
    note: "SEES the actual screenshots instead of relying on OCR text — most accurate UI steps. Needs a dedicated GPU (6 GB+ VRAM). Runs fully in-browser.",
  },
]

// A model that can take screenshots as input (so the LLM "sees" the screen).
export function isWebLLMVision(id) { return /vision/i.test(id || "") }

// Default to the balanced 3B — clearly better output than the 1B, still fits
// most machines. ensureWebLLM falls back to a lighter model if a GPU can't load it.
export const DEFAULT_WEBLLM_MODEL = "Qwen2.5-3B-Instruct-q4f32_1-MLC"

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
    // Drop chatty meta-preambles like "Okay, here's an outline based on…" that
    // small models prepend instead of answering directly.
    .replace(/^\s*(okay|ok|sure|certainly|alright|of course|got it)[,!.]?\s+(here'?s?|here is|i'?ll|i will|let me|below)[^\n]*\n+/i, '')
    .replace(/^\s*(here'?s?|here is|below is|this is)\b[^\n]*\b(outline|summary|breakdown|list|prerequisites|answer|response)[^\n]*:?\s*\n+/i, '')
    .replace(/^\s*outline\s*:[^\n]*\n+/i, '')
    .replace(/^[\*\-\s]+(?=\S)/m, '')
    .replace(/\bNow,?\s+I'?ll\b.*?[\n]/gi, '')
    .replace(/\bLet me\s+(?:now\s+)?(?:make sure|ensure|note|outline|describe|summarize)\b.*?[\n]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Ollama wants bare base64 (no "data:image/...;base64," prefix).
function stripDataUrl(u) {
  return typeof u === "string" ? u.replace(/^data:[^,]*,/, "") : u
}

export async function callOllama(userMsg, systemPrompt, model = "llama3.2", opts = {}) {
  const body = {
    model,
    prompt: `${systemPrompt}\n\n${userMsg}`,
    stream: false,
    options: { temperature: opts.temperature ?? 0.2, num_predict: opts.maxTokens ?? 512 },
  }
  // Vision models (e.g. gemma3) — pass the screenshot so the model SEES the screen.
  if (opts.images?.length) body.images = opts.images.map(stripDataUrl)

  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Ollama not reachable — is it running on localhost:11434?")
  const data = await res.json()
  return cleanLLMOutput(data.response || "")
}

// Does an Ollama model support image input? (queried from /api/show capabilities)
export async function ollamaModelHasVision(model) {
  try {
    const res = await fetch("http://localhost:11434/api/show", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return false
    const data = await res.json()
    return Array.isArray(data.capabilities) && data.capabilities.includes("vision")
  } catch { return false }
}

// onStatus is called as (label, pct, phase) so the UI can render distinct
// loading steps. preferredModel is the user's pick; on failure we fall back
// through the lighter models so a weak GPU still ends up with something.
export async function ensureWebLLM(onStatus, preferredModel) {
  // Reuse the cached engine only if it's the model the user wants — otherwise
  // unload and load the requested one (needed when switching to/from Vision).
  if (webllmEngine && (!preferredModel || webllmModel === preferredModel)) {
    onStatus?.("Model ready on WebGPU", 100, "ready")
    return webllmEngine
  }
  if (webllmEngine && preferredModel && webllmModel !== preferredModel) {
    try { await webllmEngine.unload?.() } catch { /* noop */ }
    webllmEngine = null; webllmModel = null
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
  // Only attach images if the model that actually loaded supports vision (a
  // fallback to a text model must not receive image content).
  const useImages = opts.images?.length && isWebLLMVision(webllmModel)
  const userContent = useImages
    ? [{ type: "text", text: userMsg }, ...opts.images.map((url) => ({ type: "image_url", image_url: { url } }))]
    : userMsg
  const result = await engine.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 512,
  })
  return cleanLLMOutput(result.choices[0].message.content || "")
}

export function getWebLLMModel() { return webllmModel }
