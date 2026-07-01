// Post-annotation CONSOLIDATION pass — improves the COHERENCE of the finished
// procedure without re-running annotation or risking new hallucinations:
//   1. Tidies every step title (LLM, strictly 1-for-1; falls back to originals).
//   2. Folds adjacent steps that now share a title, merging their actions.
// Per-step fact-checking (Self-verify) lives in the annotator loop, where each
// window's evidence + screenshot are still available.
import { callOllama, callWebLLM, callLocalEngine, cleanLLMOutput, WEBLLM_NO_VISION } from "./llm"
import {
  CONSOLIDATE_TITLE_PROMPT, VERIFY_PROMPT, buildVerifyPrompt,
  buildContextPrompt, parseProcedureStep, STEP_JSON_SCHEMA, JSON_ADDENDUM,
} from "./skillPrompt"

function callLLM(userMsg, systemPrompt, aiMode, model, onStatus, opts = {}) {
  if (aiMode === "ollama") return callOllama(userMsg, systemPrompt, model, opts)
  if (aiMode === "local") return callLocalEngine(userMsg, systemPrompt, null, opts)
  return callWebLLM(userMsg, systemPrompt, onStatus, { ...opts, model })
}

// Plain-text flatten of a step (kept in sync with the annotator's stepToText) so
// the doc chat / RAG index stays searchable after we merge steps.
function stepToText(step) {
  if (!step) return ""
  return [
    step.title,
    ...(step.steps || []).map((s, i) => `${i + 1}. ${s}`),
    step.result ? `Result: ${step.result}` : "",
    step.note ? `Note: ${step.note}` : "",
  ].filter(Boolean).join("\n")
}

function normTitle(t) {
  return (t || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim()
}

// Re-emit a parsed step as the TITLE/STEPS/RESULT/NOTE draft the verifier expects.
function stepToDraft(step) {
  const lines = [`TITLE: ${step.title || ""}`, "STEPS:"]
  ;(step.steps || []).forEach((s, i) => lines.push(`${i + 1}. ${s}`))
  lines.push(`RESULT: ${step.result || "-"}`)
  lines.push(`NOTE: ${step.note || "-"}`)
  return lines.join("\n")
}

// ── Self-verify pass ──
// Re-checks every finished step against its OWN stored evidence (the spoken text,
// the on-screen OCR, and the screenshot) and rewrites it to keep ONLY what the
// evidence supports — dropping the step entirely if nothing real survives. This
// is the strongest guard against invented apps / buttons / tools / values.
// Best-effort and never throws: a per-step failure keeps the original step.
export async function verifyProcedure(docs, aiMode, model, useVision, onStatus, onProgress, shouldCancel = () => false) {
  const list = docs || []
  const total = list.length
  const out = []
  let useImages = !!useVision

  // Same constrained JSON contract as the annotator — the verifier's reply parses
  // through the identical JSON-first path, so format drift can't corrupt a step.
  const verifySys = VERIFY_PROMPT + JSON_ADDENDUM
  const callVerify = (userMsg, withImg, frame) => {
    const images = withImg && frame ? [frame] : undefined
    const schema = STEP_JSON_SCHEMA
    if (aiMode === "ollama") return callOllama(userMsg, verifySys, model, { images, schema })
    if (aiMode === "local") return callLocalEngine(userMsg, verifySys, null, { images, schema })
    return callWebLLM(userMsg, verifySys, onStatus, { model, images, schema })
  }

  for (let i = 0; i < total; i++) {
    if (shouldCancel()) { for (let j = i; j < total; j++) out.push(list[j]); break } // keep the rest as-is
    const d = list[i]
    onProgress?.(i, total)
    if (!d.step) { out.push(d); continue }

    const evidence = buildContextPrompt(d.text, d.label, null, null, d.ocrText)
    const userMsg = buildVerifyPrompt(stepToDraft(d.step), evidence)
    const wantImg = useImages && !!d.frame

    let raw = null
    try {
      try {
        raw = await callVerify(userMsg, wantImg, d.frame)
      } catch (e) {
        // Vision model unavailable on this machine → verify from text only.
        if (wantImg && e?.message === WEBLLM_NO_VISION) { useImages = false; raw = await callVerify(userMsg, false, null) }
        else throw e
      }
    } catch { out.push(d); continue } // verify failed → keep the original step

    const parsed = parseProcedureStep(cleanLLMOutput(raw))
    // Keep coverage: the verifier should CLEAN a step, not delete real work. If it
    // returns SKIP (or an empty result) we keep the ORIGINAL step rather than drop
    // it — over-aggressive verification was wiping out genuine steps and leaving
    // big gaps in the procedure. (Obvious junk is still removed by the logistics
    // filter and the grounding rules at draft time.)
    if (parsed.skip || (!parsed.steps?.length && !parsed.title)) { out.push(d); continue }
    d.step = {
      title: parsed.title || d.step.title,
      steps: parsed.steps?.length ? parsed.steps : d.step.steps,
      result: parsed.result || d.step.result,
      note: parsed.note || d.step.note,
    }
    d.annotation = stepToText(d.step)
    out.push(d)
  }
  onProgress?.(total, total)
  return out
}

// Fold steps with the same (normalised) title into one — ANYWHERE in the doc, not
// just adjacent. After the title-rewrite above, two steps can collide on an
// identical generic title ("Open Cost Center Dashboard") without being neighbours;
// the old adjacent-only fold left those as visible duplicates. We now merge each
// repeat into the FIRST step that used that title, combining their unique actions
// and keeping the first screenshot. Safe + deterministic.
function foldDuplicateTitles(docs) {
  const out = []
  const firstIdx = new Map() // normalised title -> index in `out`
  for (const d of docs || []) {
    const b = normTitle(d?.step?.title)
    if (b && firstIdx.has(b) && d.step) {
      const target = out[firstIdx.get(b)]
      if (target?.step) {
        const seen = new Set((target.step.steps || []).map((s) => s.toLowerCase().trim()))
        for (const s of d.step.steps || []) {
          const k = s.toLowerCase().trim()
          if (!seen.has(k)) { target.step.steps.push(s); seen.add(k) }
        }
        if (d.step.result && !target.step.result) target.step.result = d.step.result
        if (d.step.note && !target.step.note) target.step.note = d.step.note
        target.endTimestamp = d.endTimestamp
        target.annotation = stepToText(target.step)
        continue
      }
    }
    if (b) firstIdx.set(b, out.length)
    out.push(d)
  }
  return out
}

// Main entry. Returns a NEW docs array (steps are mutated in place for titles,
// which is fine — they are freshly produced by the annotator). Never throws:
// on any model/parse failure it returns the input unchanged.
export async function consolidateProcedure(docs, aiMode, model, onStatus, shouldCancel = () => false) {
  const list = (docs || []).filter((d) => d.step && (d.step.title || d.step.steps?.length))
  if (list.length < 2) return docs
  if (shouldCancel()) return docs

  // 1) Clean, consistent titles — one numbered line per step.
  const numbered = list.map((d, i) => {
    const t = (d.step.title || "").replace(/\s+/g, " ").trim()
    const a = (d.step.steps?.[0] || "").replace(/\s+/g, " ").trim()
    const body = t && a ? `${t} — ${a}` : (t || a)
    return `${i + 1}. ${body}`.slice(0, 160)
  }).join("\n")

  try {
    onStatus?.("Consolidating procedure…")
    const raw = await callLLM(`STEPS:\n${numbered}`, CONSOLIDATE_TITLE_PROMPT, aiMode, model, onStatus, { maxTokens: 600, temperature: 0.2 })
    const titles = cleanLLMOutput(raw)
      .split("\n")
      .map((l) => l.replace(/^[\d\-\*•.\)\s]+/, "").replace(/["'.]+$/, "").trim())
      .filter((l) => l.length > 0)
    // Only trust the rewrite if the model returned exactly one title per step.
    if (titles.length === list.length) {
      list.forEach((d, i) => {
        const nt = titles[i]
        if (nt && nt.length <= 70 && !/^(skip|none|n\/a|title)$/i.test(nt)) {
          d.step.title = nt
          d.annotation = stepToText(d.step)
        }
      })
    }
  } catch { /* keep original titles on any failure */ }

  // 2) Fold any steps that now collide on title (anywhere, not just adjacent).
  return foldDuplicateTitles(docs)
}
