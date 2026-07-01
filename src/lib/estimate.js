// Honest upfront estimate of a whole run for a given video on a given backend,
// so nobody thinks the app hung. Deliberately a wide range: hardware varies a
// lot. Used twice: right when the video is dropped (backend not chosen yet →
// generic default) and again in the AI settings dialog (backend-specific).
import { isWebLLMVision } from "./llm"

export function estimateRunMinutes(durationSecs, mode, webModelId, selfVerify) {
  if (!durationSecs) return null
  const mem = navigator.deviceMemory || 8
  const windows = Math.min(Math.max(12, Math.ceil(durationSecs / 45)), mem <= 4 ? 48 : 96)
  // Rough per-window seconds by backend (vision costs more than text).
  const perWindow =
    mode === "ollama" ? 25 :
    mode === "local" ? 30 :
    isWebLLMVision(webModelId) ? 100 :
    /1B/.test(webModelId || "") ? 20 : 45
  let total = windows * perWindow
  if (selfVerify) total *= 1.8                      // verify re-checks every step
  total += durationSecs * 0.5                       // Whisper small (multithreaded WASM)
  total += Math.min(140, Math.max(48, durationSecs / 40)) * 2 // OCR keyframes
  total += 120                                      // insights + consolidation
  const lo = Math.max(1, Math.round((total * 0.7) / 60))
  const hi = Math.max(lo + 1, Math.round((total * 1.5) / 60))
  return { lo, hi }
}
