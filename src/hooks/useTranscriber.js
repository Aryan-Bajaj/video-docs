import { useRef, useState, useCallback } from "react"

export default function useTranscriber() {
  const workerRef = useRef(null)
  const [transcribeStatus, setTranscribeStatus] = useState(null)
  const [transcribeProgress, setTranscribeProgress] = useState(null) // { stage, pct, file }

  const transcribe = useCallback((audioData, sampleRate) => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        workerRef.current = new Worker(
          new URL('../workers/transcriber.worker.js', import.meta.url),
          { type: 'module' }
        )
      }

      workerRef.current.onmessage = ({ data }) => {
        if (data.type === 'status') {
          setTranscribeStatus(data.msg)
        } else if (data.type === 'progress') {
          setTranscribeProgress({ stage: data.stage, pct: data.pct, file: data.file })
        } else if (data.type === 'result') {
          setTranscribeProgress(null)
          setTranscribeStatus(null)
          resolve(data.data)
        } else if (data.type === 'error') {
          setTranscribeProgress(null)
          setTranscribeStatus(null)
          reject(new Error(data.msg))
        }
      }

      workerRef.current.postMessage({ audio: audioData, sampleRate }, [audioData.buffer])
    })
  }, [])

  return { transcribe, transcribeStatus, transcribeProgress }
}
