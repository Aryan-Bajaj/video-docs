import { useRef, useCallback } from "react"

export default function useFrameExtractor() {
  const canvasRef = useRef(document.createElement("canvas"))

  const extractFrames = useCallback((videoFile, intervalSecs = 5) => {
    return new Promise((resolve) => {
      const video = document.createElement("video")
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      const frames = []

      video.src = URL.createObjectURL(videoFile)
      video.muted = true

      video.addEventListener("loadedmetadata", () => {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        const timestamps = []
        for (let t = 0; t < video.duration; t += intervalSecs) {
          timestamps.push(parseFloat(t.toFixed(2)))
        }

        let index = 0

        const captureNext = () => {
          if (index >= timestamps.length) {
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
