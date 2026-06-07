import { useRef, useCallback } from "react"

export default function useFrameExtractor() {
  const canvasRef = useRef(document.createElement("canvas"))

  // MAX_FRAMES caps how many base64 frames we hold in memory so long/large
  // videos don't OOM the browser. The interval auto-stretches past `intervalSecs`
  // for long videos; downscale keeps each frame small.
  const MAX_FRAMES = 300
  const MAX_W = 1280

  const extractFrames = useCallback((videoFile, intervalSecs = 5) => {
    return new Promise((resolve) => {
      const video = document.createElement("video")
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      const frames = []

      video.src = URL.createObjectURL(videoFile)
      video.muted = true

      video.addEventListener("loadedmetadata", () => {
        // adaptive interval: never produce more than MAX_FRAMES
        const interval = Math.max(intervalSecs, video.duration / MAX_FRAMES)
        // downscale wide videos so each base64 frame stays small
        const scale = Math.min(1, MAX_W / video.videoWidth)
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)

        const timestamps = []
        for (let t = 0; t < video.duration; t += interval) {
          timestamps.push(parseFloat(t.toFixed(2)))
        }

        let index = 0

        const captureNext = () => {
          if (index >= timestamps.length) {
            URL.revokeObjectURL(video.src)
            resolve(frames)
            return
          }
          video.currentTime = timestamps[index]
        }

        video.addEventListener("seeked", () => {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          frames.push({
            timestamp: timestamps[index],
            imageData: canvas.toDataURL("image/jpeg", 0.7),
            label: formatTime(timestamps[index])
          })
          index++
          captureNext()
        })

        captureNext()
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
