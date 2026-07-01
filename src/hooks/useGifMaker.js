import { useCallback } from "react"

// Build an animated GIF (browser-only, no server) for each documented step:
// a short ±window clip around the step's timestamp, optimised for small size.
// Optimisations: downscale to maxW, low fps, one shared 128-colour palette per
// clip, and a single reused <video>/<canvas> across all clips.

function bytesToDataURL(bytes) {
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return "data:image/gif;base64," + btoa(binary)
}

// Average luma difference between two RGBA frames, sampled for speed.
function frameDiff(a, b, px) {
  const step = Math.max(1, Math.floor(px / 2000)) * 4
  let sum = 0, n = 0
  for (let i = 0; i < px * 4; i += step) {
    const la = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2]
    const lb = 0.299 * b[i] + 0.587 * b[i + 1] + 0.114 * b[i + 2]
    sum += Math.abs(la - lb); n++
  }
  return n ? sum / n : 0
}

export default function useGifMaker() {
  // docs: [{timestamp, ...}] · returns Map<timestamp, gifDataURL>
  const makeGifs = useCallback(async (videoFile, docs, onProgress, opts = {}) => {
    // 10s clip (±5s), sharper 640px / 256-colour. Frame-dedup below keeps size
    // sane: screen recordings are mostly static, so identical frames are merged
    // into one long-delay frame instead of re-encoded.
    const { window = 5, fps = 5, maxW = 640, colors = 256, diffThreshold = 2.5 } = opts
    const gifs = new Map()
    if (!videoFile || !docs?.length) return gifs

    const { GIFEncoder, quantize, applyPalette } = await import("gifenc")

    const video = document.createElement("video")
    video.src = URL.createObjectURL(videoFile)
    video.muted = true
    await new Promise((res) => video.addEventListener("loadedmetadata", res, { once: true }))

    const scale = Math.min(1, maxW / video.videoWidth)
    const W = Math.max(2, Math.round(video.videoWidth * scale))
    const H = Math.max(2, Math.round(video.videoHeight * scale))
    const px = W * H
    const canvas = document.createElement("canvas")
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    const dur = video.duration
    const baseDelay = Math.round(1000 / fps)

    const seek = (t) => new Promise((res) => {
      video.addEventListener("seeked", res, { once: true })
      video.currentTime = Math.max(0, Math.min(dur - 0.05, t))
    })

    for (let d = 0; d < docs.length; d++) {
      onProgress?.(d, docs.length)
      // Center the clip on the moment the step's evidence screenshot was taken
      // (where the action is visible), and clamp it inside the step's own time
      // window so it never bleeds into a neighbouring step's content — the GIF
      // must show THIS step, nothing else.
      const doc = docs[d]
      const lo = doc.timestamp ?? 0
      const hi = doc.endTimestamp ?? dur
      const center = Math.min(hi, Math.max(lo, doc.frameTimestamp ?? lo))
      const start = Math.max(0, lo, center - window)
      const end = Math.min(dur, hi, center + window)
      const times = []
      for (let t = start; t <= end; t += 1 / fps) times.push(t)
      if (times.length < 2) { continue }

      // Capture + merge near-identical consecutive frames (hold them longer).
      const merged = [] // { data, delay }
      for (const t of times) {
        await seek(t)
        ctx.drawImage(video, 0, 0, W, H)
        const data = new Uint8Array(ctx.getImageData(0, 0, W, H).data.buffer.slice(0))
        const prev = merged[merged.length - 1]
        if (prev && frameDiff(prev.data, data, px) < diffThreshold) {
          prev.delay += baseDelay        // static screen → just extend the hold
        } else {
          merged.push({ data, delay: baseDelay })
        }
      }
      if (!merged.length) continue

      // One shared palette from sampled frames → smaller + no flicker.
      const sampleIdx = [0, merged.length >> 1, merged.length - 1]
      const sample = new Uint8Array(sampleIdx.length * px * 4)
      sampleIdx.forEach((fi, k) => sample.set(merged[fi].data, k * px * 4))
      const palette = quantize(sample, colors)

      const gif = GIFEncoder()
      for (const f of merged) {
        const index = applyPalette(f.data, palette)
        gif.writeFrame(index, W, H, { palette, delay: f.delay })
      }
      gif.finish()
      // Key by the step's start timestamp — that is what exports look up by.
      gifs.set(doc.timestamp ?? center, bytesToDataURL(gif.bytes()))
    }

    URL.revokeObjectURL(video.src)
    onProgress?.(docs.length, docs.length)
    return gifs
  }, [])

  return { makeGifs }
}
