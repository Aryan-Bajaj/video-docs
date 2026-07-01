import { useRef, useCallback } from "react"

export default function useFrameExtractor() {
  const canvasRef = useRef(document.createElement("canvas"))

  // Heavy screen recordings are expensive to DECODE in-browser. Seeking to a
  // small number of points decodes only NEAR those points, so sampling = much
  // faster than full playback. The sampling DENSITY flexes with the video length
  // (see below) so a 2-minute clip and a 2-hour recording are both covered well.
  // MAX_W keeps on-screen text legible for OCR / vision.
  //
  // Adaptive sampling: aim for one frame roughly every TARGET_SPACING seconds,
  // but never fewer than MIN_FRAMES (so short clips stay detailed) and never more
  // than MAX_FRAMES (so OCR time + memory stay bounded on long recordings).
  const TARGET_SPACING = 10 // seconds between frames we aim for
  const MIN_FRAMES = 12     // floor — even a 30s clip gets real coverage
  const MAX_FRAMES = 300    // ceiling — a 90-min recording still gets a frame every ~18s; memory stays bounded (~45 MB of JPEGs)
  const MAX_W = 1280
  const SEEK_TIMEOUT = 4000 // ms — skip a stalled seek instead of hanging

  // onProgress(done, total)
  const extractFrames = useCallback((videoFile, intervalSecs = 5, onProgress) => {
    return new Promise((resolve) => {
      const video = document.createElement("video")
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      const frames = []

      video.src = URL.createObjectURL(videoFile)
      video.muted = true
      video.preload = "auto"

      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        try { URL.revokeObjectURL(video.src) } catch { /* noop */ }
        resolve(frames)
      }
      video.addEventListener("error", finish)

      video.addEventListener("loadedmetadata", () => {
        const dur = video.duration
        if (!dur || !isFinite(dur)) { finish(); return }
        // Pick a frame count that scales with duration, clamped to [MIN, MAX],
        // then derive the interval from it — so density flexes with the video.
        const targetFrames = Math.max(MIN_FRAMES, Math.min(MAX_FRAMES, Math.round(dur / TARGET_SPACING)))
        const interval = dur / targetFrames
        const scale = Math.min(1, MAX_W / video.videoWidth)
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)

        const timestamps = []
        for (let t = 0; t < dur; t += interval) timestamps.push(parseFloat(t.toFixed(2)))
        const total = timestamps.length
        let index = 0

        const next = () => {
          if (settled) return
          if (index >= total) { finish(); return }
          onProgress?.(index, total)

          let handled = false
          let timer = null
          const handle = (ok) => {
            if (handled) return
            handled = true
            clearTimeout(timer)
            video.removeEventListener("seeked", onSeeked)
            if (ok) {
              try {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
                frames.push({
                  timestamp: timestamps[index],
                  imageData: canvas.toDataURL("image/jpeg", 0.7),
                  label: formatTime(timestamps[index]),
                })
              } catch { /* skip unreadable frame */ }
            }
            index++
            next()
          }
          const onSeeked = () => handle(true)
          video.addEventListener("seeked", onSeeked)
          timer = setTimeout(() => handle(false), SEEK_TIMEOUT)
          video.currentTime = timestamps[index]
        }

        next()
      })
    })
  }, [])

  return { extractFrames }
}

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0")
  const s = Math.floor(secs % 60).toString().padStart(2, "0")
  return `${m}:${s}`
}
