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

export default function useGifMaker() {
  // docs: [{timestamp, ...}] · returns Map<timestamp, gifDataURL>
  const makeGifs = useCallback(async (videoFile, docs, onProgress, opts = {}) => {
    const { window = 3, fps = 5, maxW = 420, colors = 128 } = opts
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
    const canvas = document.createElement("canvas")
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    const dur = video.duration
    const delay = Math.round(1000 / fps)

    const seek = (t) => new Promise((res) => {
      video.addEventListener("seeked", res, { once: true })
      video.currentTime = Math.max(0, Math.min(dur - 0.05, t))
    })

    for (let d = 0; d < docs.length; d++) {
      onProgress?.(d, docs.length)
      const center = docs[d].timestamp ?? 0
      const start = Math.max(0, center - window)
      const end = Math.min(dur, center + window)
      const times = []
      for (let t = start; t <= end; t += 1 / fps) times.push(t)
      if (times.length < 2) { continue }

      // capture frames
      const frames = []
      for (const t of times) {
        await seek(t)
        ctx.drawImage(video, 0, 0, W, H)
        frames.push(new Uint8Array(ctx.getImageData(0, 0, W, H).data.buffer.slice(0)))
      }

      // one shared palette from a few sampled frames → smaller + no flicker
      const sampleIdx = [0, frames.length >> 1, frames.length - 1]
      const sample = new Uint8Array(sampleIdx.length * W * H * 4)
      sampleIdx.forEach((fi, k) => sample.set(frames[fi], k * W * H * 4))
      const palette = quantize(sample, colors)

      const gif = GIFEncoder()
      for (const f of frames) {
        const index = applyPalette(f, palette)
        gif.writeFrame(index, W, H, { palette, delay })
      }
      gif.finish()
      gifs.set(center, bytesToDataURL(gif.bytes()))
    }

    URL.revokeObjectURL(video.src)
    onProgress?.(docs.length, docs.length)
    return gifs
  }, [])

  return { makeGifs }
}
