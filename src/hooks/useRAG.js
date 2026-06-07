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
    onStatus?.("Loading search model (first run ~90 MB)...", null, "embedmodel")
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
      const pct = Math.round(((i + 1) / items.length) * 100)
      onStatus?.(`Building knowledge index · ${i + 1}/${items.length} sections`, pct, "index")
      const vec = await embed(docText(items[i]), onStatus)
      index.push({ doc: items[i], vec })
    }
    indexRef.current = index
    return index.length
  }, [embed])

  const isReady = useCallback(() => indexRef.current.length > 0, [])

  // "Summary / overview" questions can't be served by 4 nearest chunks — they
  // need a spread across the whole document. Detect them and sample widely.
  const isOverviewQuestion = (q) =>
    /summar|overview|\btl;?dr\b|\bgist\b|\boverall\b|in general|main (point|idea|topic)|key (point|takeaway)|explain (this|the|everything|it all)|what(?:'s| is| are)?\b[^?]*\b(this|it|the (doc|document|file|video|recording|dashboard))\b[^?]*\b(about|do|cover|contain)|what is this/i.test(q || "")

  // Answer a question: retrieve relevant segments, ground the LLM, return answer + sources.
  const ask = useCallback(async (question, aiMode, model, onStatus) => {
    if (!indexRef.current.length) throw new Error("Documentation not indexed yet.")
    onStatus?.("Searching the document...", null, "search")
    const qvec = await embed(question, onStatus)
    const scored = indexRef.current
      .map((it) => ({ ...it, score: cosine(qvec, it.vec) }))
      .sort((a, b) => b.score - a.score)

    const overview = isOverviewQuestion(question)

    // If even the best match is weak, the document almost certainly doesn't
    // cover this. Don't force a useless "not covered" generation — tell the UI
    // so it can offer the AI's general knowledge or a web search instead.
    const TOP_SCORE_MIN = 0.32
    if (!overview && (scored[0]?.score ?? 0) < TOP_SCORE_MIN) {
      return {
        answer: null,
        notFound: true,
        sources: scored.slice(0, 3).map((r) => ({
          label: r.doc.label, timestamp: r.doc.timestamp, frame: r.doc.frame || null,
          text: (r.doc.text || (typeof r.doc.annotation === "string" ? r.doc.annotation : "") || "").slice(0, 600),
        })),
      }
    }

    let picked
    if (overview) {
      // Spread excerpts across the whole document so a summary covers everything:
      // a few of the strongest matches + evenly sampled passages over the index.
      const N = indexRef.current.length
      const sampleCount = Math.min(8, N)
      const byPos = [...indexRef.current]
      const sampled = Array.from({ length: sampleCount }, (_, k) =>
        byPos[Math.floor((k * (N - 1)) / Math.max(1, sampleCount - 1))]
      )
      const top = scored.slice(0, 4).map((r) => r.doc)
      const seen = new Set()
      picked = [...top, ...sampled.map((s) => s.doc)]
        .filter((d) => { const key = d.label + (d.text || ""); if (seen.has(key)) return false; seen.add(key); return true })
        .slice(0, 10)
    } else {
      picked = scored.slice(0, 4).map((r) => r.doc)
    }

    // Keep each excerpt shorter when there are many, to bound generation time.
    const cap = overview ? 500 : 1000
    const context = picked
      .map((d, i) => `Excerpt ${i + 1} (at ${d.label}):\n${docText(d).slice(0, cap)}`)
      .join("\n\n")

    const system = overview
      ? `You are summarizing a document/recording using ONLY the excerpts below (sampled across the whole thing).
- Give a clear, structured overview: what it is about and the main parts or steps.
- Use short bullet points where helpful.
- If something is not in the excerpts, do not invent it.

DOCUMENT EXCERPTS:
${context}`
      : `You answer questions about a software process, using ONLY the documentation excerpts below (extracted from a screen recording).
- Be specific and reference the step time (e.g. "at ${picked[0]?.label}").
- If the answer is not in the excerpts, say "That isn't covered in this documentation."
- Keep it concise and practical.

DOCUMENTATION EXCERPTS:
${context}`

    onStatus?.("Writing the answer...", null, "write")
    const answer = aiMode === "ollama"
      ? await callOllama(question, system, model, { maxTokens: overview ? 500 : 400 })
      : await callWebLLM(question, system, onStatus, { maxTokens: overview ? 500 : 400, model })

    const sources = picked.map((d) => ({
      label: d.label,
      timestamp: d.timestamp,
      frame: d.frame || null,
      text: (d.text || (typeof d.annotation === "string" ? d.annotation : "") || d.ocrText || "").slice(0, 600),
    }))
    return { answer, sources, notFound: false }
  }, [embed])

  // Answer from the model's own general knowledge (not the document). Used when
  // the document doesn't cover the question and the user opts in.
  const askGeneral = useCallback(async (question, aiMode, model, onStatus) => {
    const system = `You are a helpful technical assistant. Answer the user's question from your own general knowledge. The user's uploaded document does not cover this topic, so do not refer to it or claim it does. Be concise, accurate and practical, with clear steps where useful. If you are genuinely unsure, say so.`
    onStatus?.("Answering from the AI model...", null, "write")
    const answer = aiMode === "ollama"
      ? await callOllama(question, system, model, { maxTokens: 500 })
      : await callWebLLM(question, system, onStatus, { maxTokens: 500, model })
    return answer
  }, [])

  return { buildIndex, ask, askGeneral, isReady }
}
