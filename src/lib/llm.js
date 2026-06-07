// Shared local-LLM calls (Ollama + WebLLM) used by both annotation and RAG chat.
// Everything runs locally / in-browser — no servers, no API keys.

let webllmEngine = null
let webllmModel = null

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

export async function ensureWebLLM(onStatus) {
  if (webllmEngine) return webllmEngine
  const { CreateMLCEngine } = await import("@mlc-ai/web-llm")
  onStatus?.("Initializing WebLLM (first run downloads model)...")
  const MODELS = ["Llama-3.2-3B-Instruct-q4f32_1-MLC", "Llama-3.2-1B-Instruct-q4f32_1-MLC"]
  let lastErr = null
  for (const m of MODELS) {
    try {
      webllmEngine = await CreateMLCEngine(m, { initProgressCallback: (p) => onStatus?.(p.text ?? "Loading model...") })
      webllmModel = m
      return webllmEngine
    } catch (e) { lastErr = e }
  }
  throw lastErr ?? new Error("WebLLM failed to load")
}

export async function callWebLLM(userMsg, systemPrompt, onStatus, opts = {}) {
  const engine = await ensureWebLLM(onStatus)
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
