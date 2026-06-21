import { pipeline } from '@huggingface/transformers'

let pipe = null
let cancelled = false

async function load(onProgress) {
  if (!pipe) {
    // whisper-small.en — best accuracy on accented / technical speech (names,
    // jargon like SAP, cost centers). The transcript is the LLM's only "ears",
    // so this is the single biggest lever on documentation quality. Larger
    // (~970MB one-time download) and slower than base, but far more complete.
    pipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small.en', {
      dtype: 'fp32',
      chunk_length_s: 30,
      stride_length_s: 5,
      progress_callback: onProgress,
    })
  }
  return pipe
}

self.onmessage = async ({ data }) => {
  // A cancel message can arrive mid-run; flip the flag and the window loop stops.
  if (data?.type === 'cancel') { cancelled = true; return }
  cancelled = false

  try {
    self.postMessage({ type: 'status', stage: 'loading', msg: 'Loading Whisper model (first run ~970MB, cached after)...' })

    const asr = await load((p) => {
      if (p.status === 'progress') {
        self.postMessage({ type: 'progress', stage: 'downloading', pct: Math.round(p.progress ?? 0), file: p.file ?? '' })
      }
    })

    self.postMessage({ type: 'status', stage: 'transcribing', msg: 'Transcribing audio...' })

    // Process the audio in bounded windows so a long (1hr+) recording never holds
    // huge intermediate buffers, reports real progress, and can be cancelled.
    const audio = data.audio
    const sr = data.sampleRate
    const WINDOW = 300 * sr               // 5-minute windows
    const total = audio.length
    const numWindows = Math.max(1, Math.ceil(total / WINDOW))

    const allChunks = []
    let fullText = ''

    for (let w = 0; w < numWindows; w++) {
      if (cancelled) break
      const start = w * WINDOW
      const end = Math.min(start + WINDOW, total)
      const slice = audio.subarray(start, end)
      const offset = start / sr

      const result = await asr(slice, { return_timestamps: true })

      for (const c of (result.chunks ?? [])) {
        const ts = c.timestamp ?? [null, null]
        const s = (ts[0] ?? 0) + offset
        const e = (ts[1] ?? ts[0] ?? 0) + offset
        allChunks.push({ text: c.text, timestamp: [s, e] })
      }
      fullText += (result.text ?? '') + ' '

      self.postMessage({
        type: 'progress',
        stage: 'transcribing',
        pct: Math.round(((w + 1) / numWindows) * 100),
        window: w + 1,
        windows: numWindows,
      })
    }

    self.postMessage({ type: 'result', data: { text: fullText.trim(), chunks: allChunks, cancelled } })
  } catch (e) {
    self.postMessage({ type: 'error', msg: e.message })
  }
}
