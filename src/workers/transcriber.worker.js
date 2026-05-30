import { pipeline } from '@huggingface/transformers'

let pipe = null

async function load(onProgress) {
  if (!pipe) {
    pipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
      dtype: 'fp32',
      chunk_length_s: 30,
      stride_length_s: 5,
      progress_callback: onProgress,
    })
  }
  return pipe
}

self.onmessage = async ({ data }) => {
  try {
    self.postMessage({ type: 'status', stage: 'loading', msg: 'Loading Whisper model (first run ~150MB)...' })

    const asr = await load((p) => {
      if (p.status === 'progress') {
        self.postMessage({
          type: 'progress',
          stage: 'downloading',
          pct: Math.round(p.progress ?? 0),
          file: p.file ?? '',
        })
      }
    })

    self.postMessage({ type: 'progress', stage: 'transcribing', pct: null })
    self.postMessage({ type: 'status', stage: 'transcribing', msg: 'Transcribing audio...' })

    const result = await asr(data.audio, {
      sampling_rate: data.sampleRate,
      return_timestamps: true,
    })

    self.postMessage({ type: 'result', data: result })
  } catch (e) {
    self.postMessage({ type: 'error', msg: e.message })
  }
}
