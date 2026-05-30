import { useRef, useEffect } from "react"

export default function VideoPlayer({ file, seekTo }) {
  const videoRef = useRef()

  useEffect(() => {
    if (seekTo !== null && seekTo !== undefined && videoRef.current) {
      videoRef.current.currentTime = seekTo
      videoRef.current.play()
    }
  }, [seekTo])

  return (
    <div className="rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
      <video
        ref={videoRef}
        className="w-full"
        controls
        src={URL.createObjectURL(file)}
      />
    </div>
  )
}
