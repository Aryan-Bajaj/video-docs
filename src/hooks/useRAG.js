import { useRef, useCallback } from "react"
import { callOllama, callWebLLM } from "../lib/llm"

// Browser-only RAG over the generated documentation.
// Embeddings: transformers.js MiniLM (ONNX, in-browser). Store: in-memory cosine.
// LLM: the same local Ollama / WebLLM. No server, no API keys.

const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2"

function docText(doc) {
  const a = typeof doc.annotation === "string" ? doc.annotation : ""
  return [`[${doc.label}]`, doc.text || "", a, doc.ocrText || ""].filter(Boolean).join("\n").slice(0, 1200)
}

function cosine(a, b) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s // vectors are normalized → dot product = cosine
}

export default function useRAG() {
  const embedderRef = useRef(null)
  const indexRef = useRef([]) // [{ doc, vec }]

  const getEmbedder = useCallback(async (onStatus) => {
    if (embedderRef.current) return embedderRef.current
    const { pipeline } = await import("@huggingface/transformers")
    onStatus?.("Loading embedding model (first run downloads ~90MB)...")
    embedderRef.current = await pipeline("feature-extraction", EMBED_MODEL)
    return embedderRef.current
  }, [])

  const embed = useCallback(async (text, onStatus) => {
    const embedder = await getEmbedder(onStatus)
    const out = await embedder(text, { pooling: "mean", normalize: true })
    return Array.from(out.data)
  }, [getEmbedder])

  // Build the vector index from documentation segments.
  const buildIndex = useCallback(async (docs, onStatus) => {
    const items = (docs || []).filter((d) => (d.text || d.annotation))
    const index = []
    for (let i = 0; i < items.length; i++) {
      onStatus?.(`Indexing documentation ${i + 1}/${items.length}...`)
      const vec = await embed(docText(items[i]), onStatus)
      index.push({ doc: items[i], vec })
    }
    indexRef.current = index
    return index.length
  }, [embed])

  const isReady = useCallback(() => indexRef.current.length > 0, [])

  // Answer a question: retrieve top-k segments, ground the LLM, return answer + sources.
  const ask = useCallback(async (question, aiMode, ollamaModel, onStatus) => {
    if (!indexRef.current.length) throw new Error("Documentation not indexed yet.")
    const qvec = await embed(question, onStatus)
    const ranked = indexRef.current
      .map((it) => ({ ...it, score: cosine(qvec, it.vec) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)

    const context = ranked
      .map((r, i) => `Excerpt ${i + 1} (at ${r.doc.label}):\n${docText(r.doc)}`)
      .join("\n\n")

    const system = `You answer questions about a software process, using ONLY the documentation excerpts below (extracted from a screen recording).
- Be specific and reference the step time (e.g. "at ${ranked[0]?.doc.label}").
- If the answer is not in the excerpts, say "That isn't covered in this documentation."
- Keep it concise and practical.

DOCUMENTATION EXCERPTS:
${context}`

    onStatus?.("Thinking...")
    const answer = aiMode === "ollama"
      ? await callOllama(question, system, ollamaModel, { maxTokens: 400 })
      : await callWebLLM(question, system, onStatus, { maxTokens: 400 })

    const sources = ranked.map((r) => ({
      label: r.doc.label,
      timestamp: r.doc.timestamp,
      frame: r.doc.frame || null,
      score: r.score,
    }))
    return { answer, sources }
  }, [embed])

  return { buildIndex, ask, isReady }
}
