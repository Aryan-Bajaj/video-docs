import { useCallback } from "react"

export default function useAudioExtractor() {
  const extractAudio = useCallback(async (videoFile) => {
    const targetRate = 16000 // Whisper wants 16 kHz mono

    // Decode the audio. The usual cause of "Could not decode audio" on long
    // recordings is MEMORY: the browser decodes the WHOLE file to PCM at the
    // native rate (e.g. 32 min @ 48 kHz stereo ≈ 700 MB) and runs out of room.
    // Decoding straight to 16 kHz cuts that ~6x. We re-read the blob per attempt
    // (decodeAudioData detaches its ArrayBuffer) and fall back to the native rate,
    // so this flexes across any length / sample rate / codec the browser supports.
    const decodeAt = async (rate) => {
      const ab = await videoFile.arrayBuffer()
      let ctx
      try { ctx = new AudioContext(rate ? { sampleRate: rate } : undefined) }
      catch { ctx = new AudioContext() } // some browsers reject a custom rate
      try { return await ctx.decodeAudioData(ab) }
      finally { try { await ctx.close() } catch { /* noop */ } }
    }

    let decoded = null
    try { decoded = await decodeAt(targetRate) }       // low-memory path
    catch { /* fall through to native-rate retry */ }
    if (!decoded) {
      try { decoded = await decodeAt(null) }            // native-rate fallback
      catch {
        throw new Error("Could not decode the audio. Please re-export the recording as MP4 (H.264 video + AAC audio) and try again — that format always works.")
      }
    }

    // Resample to 16 kHz mono AND clean the audio in one offline render: a light
    // speech-focused denoise so the transcript is cleaner (fewer garbled words).
    const length = Math.max(1, Math.ceil(decoded.duration * targetRate))
    const offlineCtx = new OfflineAudioContext(1, length, targetRate)
    const source = offlineCtx.createBufferSource()
    source.buffer = decoded

    // High-pass ~85 Hz: kills low rumble, fans, AC hum, desk thumps.
    const highpass = offlineCtx.createBiquadFilter()
    highpass.type = "highpass"; highpass.frequency.value = 85

    // Low-pass ~7500 Hz: trims hiss near the top of the band (Nyquist is 8 kHz).
    const lowpass = offlineCtx.createBiquadFilter()
    lowpass.type = "lowpass"; lowpass.frequency.value = 7500

    // Presence bump around 2.5 kHz: speech consonants sit here — lifts clarity.
    const presence = offlineCtx.createBiquadFilter()
    presence.type = "peaking"; presence.frequency.value = 2500; presence.Q.value = 1; presence.gain.value = 3

    // Compressor: evens out loud/quiet speakers so quiet voices aren't lost.
    const comp = offlineCtx.createDynamicsCompressor()
    comp.threshold.value = -28; comp.knee.value = 24; comp.ratio.value = 3
    comp.attack.value = 0.005; comp.release.value = 0.25

    source.connect(highpass)
    highpass.connect(lowpass)
    lowpass.connect(presence)
    presence.connect(comp)
    comp.connect(offlineCtx.destination)
    source.start()
    const rendered = await offlineCtx.startRendering()

    // Peak-normalise so the whole clip sits at a consistent, healthy level for Whisper.
    const data = rendered.getChannelData(0)
    let peak = 0
    for (let i = 0; i < data.length; i++) { const a = Math.abs(data[i]); if (a > peak) peak = a }
    if (peak > 0 && peak < 0.95) {
      const g = 0.95 / peak
      for (let i = 0; i < data.length; i++) data[i] *= g
    }

    return { audio: data, sampleRate: targetRate }
  }, [])

  return { extractAudio }
}
