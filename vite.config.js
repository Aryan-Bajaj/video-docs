import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['@huggingface/transformers', '@mlc-ai/web-llm', 'onnxruntime-web'],
    include: ['three', 'vanta/dist/vanta.net.min', 'vanta/dist/vanta.halo.min'],
  },
  worker: {
    format: 'es'
  },
  // Required for SharedArrayBuffer (Whisper WASM) in dev
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  }
})
