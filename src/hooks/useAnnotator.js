import { useCallback } from "react"
import {
  PROCEDURE_PROMPT, VISION_ADDENDUM, buildContextPrompt, parseProcedureStep, isMeetingNoise,
  IDENTIFY_APP_PROMPT, parseAppName, appContextPrefix, isLogisticsStep,
  STEP_JSON_SCHEMA, JSON_ADDENDUM, cleanTranscriptText, hasActionWords, RECALL_ADDENDUM,
} from "../lib/skillPrompt"
import { callOllama, callWebLLM, callLocalEngine, WEBLLM_NO_VISION } from "../lib/llm"
import { ocrNear } from "./useOCR"

// ── Screen-share start detection ──
// A meeting recording often opens with minutes of webcams only — transcript but
// no application on screen. Any step written from that speech alone is fabricated
// ("Open About Page" from someone TALKING about a page). Find the first moment
// the screen shows a text-rich application and refuse to write steps before it.
// Two nearby rich frames are required so one lucky OCR hit on a webcam/desktop
// frame can't open the gate early. No rich frames at all → gate off (a video
// where OCR failed everywhere should still be documented from the transcript).
const RICH_OCR_LEN = 60
function screenShareStart(ocrFrameTexts) {
  const rich = (ocrFrameTexts || []).filter(
    (f) => (f.text || "").replace(/\s+/g, " ").trim().length >= RICH_OCR_LEN,
  )
  if (!rich.length) return null
  for (let i = 0; i + 1 < rich.length; i++) {
    if (rich[i + 1].timestamp - rich[i].timestamp <= 120) return rich[i].timestamp
  }
  return rich[0].timestamp
}

// ── Scene-change segmentation ──
// Steps should align with what HAPPENED, not with the clock. A boundary is placed
// wherever the on-screen text turns over hard (new dialog, tab, screen, app) —
// measured as token overlap between consecutive OCR frames. A long static screen
// stays one window; a dense config minute splits into several.
function tokenSet(t) {
  return new Set((t || "").toLowerCase().match(/[a-z0-9]{3,}/g) || [])
}
function ocrSimilarity(a, b) {
  const A = tokenSet(a), B = tokenSet(b)
  if (!A.size || !B.size) return 1 // unreadable frame → never invent a boundary
  let inter = 0
  for (const w of A) if (B.has(w)) inter++
  return inter / Math.min(A.size, B.size)
}
const SCENE_SIM_THRESHOLD = 0.35 // below this overlap the screen "changed"
const SCENE_MIN_GAP = 12         // s — a fast transition burst is ONE change
function sceneBoundaries(ocrFrameTexts, t0, maxT) {
  const fr = (ocrFrameTexts || []).filter(
    (f) => f.timestamp > t0 + 5 && f.timestamp < maxT - 5 && (f.text || "").trim(),
  )
  if (fr.length < 6) return null // too little OCR to segment on → caller falls back to time
  const cuts = []
  for (let i = 1; i < fr.length; i++) {
    if (ocrSimilarity(fr[i - 1].text, fr[i].text) < SCENE_SIM_THRESHOLD) {
      if (!cuts.length || fr[i].timestamp - cuts[cuts.length - 1] >= SCENE_MIN_GAP) {
        cuts.push(fr[i].timestamp)
      }
    }
  }
  return cuts
}

// Assemble [start,end] windows. Boundary sources, best first:
//   1. PIXEL scene cuts (from the keyframe fingerprint pass) — robust on blurry
//      recordings where OCR text is garbage.
//   2. OCR-token similarity cuts — fallback when no pixel cuts were provided.
//   3. Fixed time slicing — last resort.
// Long segments split (dense work → separate steps), tiny ones merged.
const MIN_WINDOW = 25, MAX_WINDOW = 70
function buildSegments(ocrFrameTexts, maxT, shareStart, sceneCuts = []) {
  const t0 = shareStart ?? 0
  const span = maxT - t0
  if (span <= MIN_WINDOW) return span > 1 ? [[t0, maxT]] : []
  // Pixel cuts: clamp into range, enforce spacing (a fast transition burst = one change).
  const pixel = []
  for (const c of [...(sceneCuts || [])].sort((a, b) => a - b)) {
    if (c <= t0 + 5 || c >= maxT - 5) continue
    if (!pixel.length || c - pixel[pixel.length - 1] >= SCENE_MIN_GAP) pixel.push(c)
  }
  const cuts = pixel.length >= 3 ? pixel : sceneBoundaries(ocrFrameTexts, t0, maxT)
  let edges
  if (cuts?.length) {
    edges = [t0, ...cuts, maxT]
  } else {
    const step = Math.min(MAX_WINDOW, Math.max(35, span / 50))
    edges = [t0]
    for (let t = t0 + step; t < maxT - 1; t += step) edges.push(t)
    edges.push(maxT)
  }
  // Split over-long segments evenly…
  const split = []
  for (let i = 0; i + 1 < edges.length; i++) {
    const a = edges[i], b = edges[i + 1]
    const n = Math.max(1, Math.ceil((b - a) / MAX_WINDOW))
    const w = (b - a) / n
    for (let k = 0; k < n; k++) split.push([a + k * w, k === n - 1 ? b : a + (k + 1) * w])
  }
  // …and fold under-short ones into their predecessor (unless that makes a giant).
  const merged = []
  for (const s of split) {
    const prev = merged[merged.length - 1]
    if (prev && s[1] - s[0] < MIN_WINDOW && s[1] - prev[0] <= MAX_WINDOW + MIN_WINDOW) prev[1] = s[1]
    else merged.push([...s])
  }
  return merged
}

// Every window is one LLM call, and on a weak office laptop a call can take
// 30-60s. Cap the call count by device memory (browsers report at most 8, so
// ≤4 is genuinely low-end) by folding the shortest neighbouring windows together
// — a long video still gets full COVERAGE, just in coarser slices.
function capSegments(segs, maxN) {
  const out = segs.map((s) => [...s])
  while (out.length > maxN) {
    let bi = 0, best = Infinity
    for (let i = 0; i + 1 < out.length; i++) {
      const len = out[i + 1][1] - out[i][0]
      if (len < best) { best = len; bi = i }
    }
    out[bi] = [out[bi][0], out[bi + 1][1]]
    out.splice(bi + 1, 1)
  }
  return out
}

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
  // onDraft(docsSoFar) fires after every completed window so the UI can show
  // steps appearing live instead of a bare progress bar.
  const annotate = useCallback(async (
    chunks, frames, aiMode, onProgress, onStatus, sections, ollamaModel, ocrFrameTexts = [],
    shouldCancel = () => false, useVision = false, sceneCuts = [], onDraft = null,
  ) => {
    // Build windows across the WHOLE video timeline (not just where someone spoke),
    // so silent stretches are still documented from the on-screen (OCR) text.
    const lastChunk = chunks?.length ? (chunks[chunks.length - 1].timestamp?.[1] ?? chunks[chunks.length - 1].timestamp?.[0] ?? 0) : 0
    const lastFrame = frames?.length ? frames[frames.length - 1].timestamp : 0
    const maxT = Math.max(lastChunk, lastFrame, 1)

    // 1) Gate: nothing before the screen-share actually starts can become a step.
    // Distrust a LATE detection: on blurry recordings (Teams downscales hard)
    // Tesseract fails on most frames, and the first frame that happens to OCR
    // well can be deep into the video — gating there would erase real work
    // (this exact failure collapsed a 32-min SAC session to one step). If the
    // "start" lands past 40% of the timeline, fall back to the first frame with
    // ANY readable text.
    let shareStart = screenShareStart(ocrFrameTexts)
    if (shareStart != null && shareStart > maxT * 0.4) {
      const anyOcr = (ocrFrameTexts || []).find((f) => (f.text || "").trim().length >= 20)
      if (anyOcr && anyOcr.timestamp < shareStart) shareStart = anyOcr.timestamp
    }
    // 2) Segment on SCREEN CHANGES (fixed slicing only as fallback)…
    let segments = buildSegments(ocrFrameTexts, maxT, shareStart, sceneCuts)
    // 3) …bounded by what this machine can chew through in reasonable time.
    // The cap SCALES with video length (one window per ~45s of recording) so a
    // 60-minute video gets proportionally more steps than a 30-minute one —
    // detail must grow with the video, not get squeezed into a fixed budget.
    // Low-memory machines get a lower ceiling; they trade some step granularity
    // for actually finishing.
    const mem = navigator.deviceMemory || 8
    const span = maxT - (shareStart ?? 0)
    const wanted = Math.max(12, Math.ceil(span / 45))
    segments = capSegments(segments, Math.min(wanted, mem <= 4 ? 48 : 96))

    const windows = []
    for (const [a, b] of segments) {
      const center = a + (b - a) / 2
      // Scrub meeting chatter / filler / ASR repeats from the narration BEFORE it
      // reaches any prompt — junk talk can't become a step it was never part of.
      const text = cleanTranscriptText((chunks || [])
        .filter((c) => { const s = c.timestamp?.[0] ?? 0; return s >= a && s < b })
        .map((c) => c.text.trim()).join(' ').trim())
      const ocr = ocrNear(ocrFrameTexts, center, Math.max((b - a) / 2 + 6, 12))
      // Keep the window when ANY evidence channel is live. OCR regularly fails
      // wholesale on blurry meeting recordings, so an empty `ocr` must NEVER
      // drop a window on its own — with vision the model still SEES the screen,
      // and the share gate above already removed the webcam-only intro.
      if (!text && !ocr && !useVision) continue
      windows.push({ a, b, center, text, ocr })
    }

    const results = []
    let lastError = null
    let okCount = 0

    // With vision the model SEES the screen, so OCR text is dropped and the
    // vision instructions are added. `visionLive` can flip off mid-run if the
    // chosen vision model turns out unavailable on this machine (e.g. GPU too
    // small → text-only fallback) — from then on we annotate from OCR text
    // instead of re-attempting vision on every window.
    let visionLive = useVision

    // Identify the application ONCE from the actual screen — the richest OCR frame
    // plus its screenshot — so every step is anchored to the real software. Fully
    // model-driven (works for any app, nothing hardcoded). Failure → stays generic.
    let appName = ""
    try {
      const rich = [...(ocrFrameTexts || [])].sort((a, b) => (b.text || "").length - (a.text || "").length)[0]
      if (rich && (rich.text || "").trim().length > 10) {
        const idFrame = nearestFrame(frames, rich.timestamp)
        const idMsg = `On-screen text (OCR):\n${(rich.text || "").slice(0, 1500)}`
        const withImg = visionLive && !!idFrame?.imageData
        const idImages = withImg ? [idFrame.imageData] : undefined
        const idCall = (imgs) => aiMode === "ollama"
          ? callOllama(idMsg, IDENTIFY_APP_PROMPT, ollamaModel, { images: imgs })
          : aiMode === "local"
          ? callLocalEngine(idMsg, IDENTIFY_APP_PROMPT, null, { images: imgs })
          : callWebLLM(idMsg, IDENTIFY_APP_PROMPT, onStatus, { model: ollamaModel, images: imgs })
        let idRaw = null
        try { idRaw = await idCall(idImages) }
        catch { idRaw = await idCall(undefined) } // vision unavailable → identify from text
        appName = parseAppName(idRaw)
      }
    } catch { /* leave appName empty — prompts just stay generic */ }
    const sysPrefix = appContextPrefix(appName)

    // Annotate one window either WITH the screenshot (vision) or text-only (OCR).
    const runWindow = (win, frame, label, prev, next, withVision, extra = "") => {
      const useImg = withVision && !!frame?.imageData
      // JSON_ADDENDUM goes LAST so the format contract is the model's freshest
      // instruction; the schema makes the engines enforce it at the sampler.
      const prompt = sysPrefix + (useImg ? PROCEDURE_PROMPT + VISION_ADDENDUM : PROCEDURE_PROMPT) + extra + JSON_ADDENDUM
      const userMsg = buildContextPrompt(win.text, label, prev, next, useImg ? null : win.ocr)
      const images = useImg ? [frame.imageData] : undefined
      const schema = STEP_JSON_SCHEMA
      return aiMode === "ollama"
        ? callOllama(userMsg, prompt, ollamaModel, { images, schema })
        : aiMode === "local"
        ? callLocalEngine(userMsg, prompt, null, { images, schema })
        : callWebLLM(userMsg, prompt, onStatus, { model: ollamaModel, images, schema })
    }

    for (let i = 0; i < windows.length; i++) {
      if (shouldCancel()) break // user cancelled — keep what we have so far
      const win = windows[i]
      const label = formatTS(win.a)
      const frame = pickFrame(frames, ocrFrameTexts, win.a, win.b, win.center)
      const prevText = windows[i - 1]?.text ?? null
      const nextText = windows[i + 1]?.text ?? null

      onProgress?.(i, windows.length)

      // Noise gate: skip pure meeting / AV-logistics chatter (mic checks, screen
      // sharing, greetings) that has no real on-screen content, so it never turns
      // into a step. Only drops when the screen text is also empty — a window
      // that shows actual work is always sent to the model.
      const ocrLen = (win.ocr || "").replace(/\s+/g, " ").trim().length
      if (isMeetingNoise(win.text) && ocrLen < 40) continue

      let raw = null
      try {
        const tryVision = visionLive && !!frame?.imageData
        try {
          raw = await runWindow(win, frame, label, prevText, nextText, tryVision)
        } catch (visErr) {
          if (!tryVision) throw visErr // a text-only attempt failed for real
          // Vision failed for THIS window (oversized frame, transient GPU OOM, or
          // a text-only fallback model loaded). Retry from OCR text so the step is
          // never lost. If the model simply can't do vision, stop trying it.
          if (visErr?.message === WEBLLM_NO_VISION) visionLive = false
          raw = await runWindow(win, frame, label, prevText, nextText, false)
        }
        okCount++
      } catch (e) {
        lastError = e // remember it; surfaced below if nothing succeeds
        continue
      }

      let step = parseProcedureStep(raw)
      let fromRetry = false
      if (step.skip) {
        // Recall guard: strong evidence + a skip is more likely a model miss
        // than true noise. Strong = spoken action verbs, a text-rich screen, OR
        // (the meeting-recording reality) vision on + a screenshot + sustained
        // talk — people discuss vaguely WHILE doing concrete on-screen work.
        // ONE second look; if the model still skips, trust it.
        const strongEvidence = hasActionWords(win.text) || ocrLen >= 80
          || (visionLive && !!frame?.imageData && (win.text || "").length >= 60)
        if (!strongEvidence) continue
        try {
          const raw2 = await runWindow(win, frame, label, prevText, nextText, visionLive && !!frame?.imageData, RECALL_ADDENDUM)
          step = parseProcedureStep(raw2)
          fromRetry = true
        } catch { continue }
        if (step.skip) continue // confirmed: nothing real here
      }
      if (isLogisticsStep(step)) continue // meeting logistics / webcam-name tile → not a procedure step

      // Confidence flag for the reviewer: a step the model first skipped, or one
      // written from thin evidence (little speech AND little readable screen
      // text), deserves a human look. Shown as a subtle marker in the UI.
      const lowConfidence = fromRetry
        || ((win.text || "").length < 40 && ocrLen < 40 && !(visionLive && frame?.imageData))

      results.push({
        timestamp: win.a,
        endTimestamp: win.b,
        label,
        step,                       // { title, steps[], result, note }
        annotation: stepToText(step), // plain text for doc chat / RAG
        text: win.text || step.title || "",
        frame: frame?.imageData ?? null,
        // The moment the evidence screenshot was taken — step clips/GIFs center
        // HERE (where the action is visible), not on the window's start edge.
        frameTimestamp: frame?.timestamp ?? win.center,
        ocrText: win.ocr || null,
        lowConfidence,
      })
      // Live draft: let the UI render steps as they are written.
      onDraft?.([...results])
    }

    // If every window errored (wrong Ollama model, WebLLM couldn't load), surface
    // the real error instead of silently returning an empty procedure.
    if (windows.length && okCount === 0 && lastError) {
      throw new Error(`Annotation failed: ${lastError.message}. Check the selected model is installed (Ollama) or try WebLLM.`)
    }

    const out = mergeDuplicateSteps(results)
    // Expose the LLM-identified app so the UI can show "SAP Analytics Cloud"
    // instead of the OCR regex's generic "SAP" hit in Tools used.
    if (appName) out.appName = appName
    return out
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
