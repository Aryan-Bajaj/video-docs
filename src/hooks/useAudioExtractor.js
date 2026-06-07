import { useCallback } from "react"

export default function useAudioExtractor() {
  const extractAudio = useCallback(async (videoFile) => {
    const arrayBuffer = await videoFile.arrayBuffer()

    // Decode at native sample rate first
    const tempCtx = new AudioContext()
    let decoded
    try {
      decoded = await tempCtx.decodeAudioData(arrayBuffer)
    } catch (e) {
      await tempCtx.close()
      throw new Error("Could not decode audio — the file may be too long or in an unsupported codec. Try a shorter clip.")
    }
    await tempCtx.close()

    // Resample to 16kHz mono (Whisper requirement)
    const targetRate = 16000
    const offlineCtx = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetRate), targetRate)
    const source = offlineCtx.createBufferSource()
    source.buffer = decoded
    source.connect(offlineCtx.destination)
    source.start()
    const resampled = await offlineCtx.startRendering()

    return { audio: resampled.getChannelData(0), sampleRate: targetRate }
  }, [])

  return { extractAudio }
}
