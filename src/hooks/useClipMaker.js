import { useCallback } from "react"

// Build a short, sharp WebM video clip per step (true colour, far clearer than a
// GIF, and smaller). Captured in-browser via canvas.captureStream + MediaRecorder,
// then base64-inlined into the HTML — no server, no storage, one self-contained file.

function pickMime() {
  const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"]
  for (const t of types) {
    try { if (window.MediaRecorder?.isTypeSupported?.(t)) return t } catch { /* noop */ }
  }
  return "video/webm"
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

// Record the video from `start` to `end` (real-time) into a WebM blob.
function recordRange(video, canvas, ctx, start, end, fps, mime, seek) {
  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(fps)
    const chunks = []
    let rec
    try {
      rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_500_000 })
    } catch (e) { reject(e); return }
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
    rec.onstop = () => resolve(new Blob(chunks, { type: mime }))
    rec.onerror = (e) => reject(e)

    let drawing = true
    const draw = () => {
      if (!drawing) return
      try { ctx.drawImage(video, 0, 0, canvas.width, canvas.height) } catch { /* frame not ready */ }
      requestAnimationFrame(draw)
    }
    const onTime = () => {
      if (video.currentTime >= end - 0.02 || video.ended) {
        video.removeEventListener("timeupdate", onTime)
        try { video.pause() } catch { /* noop */ }
        drawing = false
        setTimeout(() => { try { rec.stop() } catch { /* noop */ } }, 150)
      }
    }

    seek(start).then(() => {
      rec.start()
      draw()
      video.addEventListener("timeupdate", onTime)
      video.play().catch((e) => { drawing = false; try { rec.stop() } catch { /* noop */ } ; reject(e) })
    })
  })
}

export default function useClipMaker() {
  // docs: [{timestamp, ...}] · returns Map<timestamp, webmDataURL>
  const makeClips = useCallback(async (videoFile, docs, onProgress, opts = {}) => {
    const { pad = 4, fps = 20, maxW = 1280 } = opts // ~8s clips, sharp 1280px
    const clips = new Map()
    if (!videoFile || !docs?.length || !window.MediaRecorder) return clips // unsupported → caller keeps frames

    const video = document.createElement("video")
    video.src = URL.createObjectURL(videoFile)
    video.muted = true
    video.playsInline = true
    await new Promise((res) => video.addEventListener("loadedmetadata", res, { once: true }))

    const scale = Math.min(1, maxW / video.videoWidth)
    const W = Math.max(2, Math.round(video.videoWidth * scale))
    const H = Math.max(2, Math.round(video.videoHeight * scale))
    const canvas = document.createElement("canvas")
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext("2d")
    const dur = video.duration
    const mime = pickMime()

    const seek = (t) => new Promise((res) => {
      video.addEventListener("seeked", res, { once: true })
      video.currentTime = Math.max(0, Math.min(dur - 0.05, t))
    })

    for (let d = 0; d < docs.length; d++) {
      onProgress?.(d, docs.length)
      // Center the clip on the moment the step's evidence screenshot was taken
      // (the action itself), clamped inside the step's own time window so it
      // never shows a neighbouring step's content. Keyed by the step's start
      // timestamp — that is what exports look up by.
      const doc = docs[d]
      const lo = doc.timestamp ?? 0
      const hi = doc.endTimestamp ?? dur
      const center = Math.min(hi, Math.max(lo, doc.frameTimestamp ?? lo))
      const start = Math.max(0, lo, center - pad)
      const end = Math.min(dur, hi, center + pad)
      if (end - start < 1) continue
      try {
        const blob = await recordRange(video, canvas, ctx, start, end, fps, mime, seek)
        if (blob && blob.size) clips.set(doc.timestamp ?? center, await blobToDataURL(blob))
      } catch { /* skip this clip */ }
    }

    try { URL.revokeObjectURL(video.src) } catch { /* noop */ }
    onProgress?.(docs.length, docs.length)
    return clips
  }, [])

  return { makeClips }
}
