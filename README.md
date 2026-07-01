# VideoDoc

Turn any screen recording into clean, step by step documentation. Everything runs on your own machine: transcription, screen reading and the AI writing all happen locally, so the video never leaves your device.

No uploads. No account. No API keys. That is the whole point of this tool: you can throw an internal company recording at it without asking anyone for permission, because there is nothing to ask permission for.

## What you get

Drop in a recording (a Teams meeting, a training session, a quick screen capture) and VideoDoc produces:

- A numbered procedure with exact actions, results and notes per step, each with a screenshot from the right moment
- A purpose statement, prerequisites and an executive summary
- Key observations and an FAQ built from questions people actually asked in the session
- A process flow diagram
- Exports to PDF, Word and HTML, all editable before export

Steps are grounded in three evidence channels at once: what was said (Whisper), what was on screen as text (OCR) and what the screen actually showed (a vision model that looks at the screenshots). A verification pass then rechecks every step against its own evidence before it lands in the document.

## Two ways to run it

### 1. In the browser (hosted or `npm run dev`)

The web version uses WebLLM (AI in the browser via WebGPU) or a local Ollama install if you have one. Good for trying it out and for machines with a decent GPU.

```
npm install
npm run dev
```

Then open http://localhost:5175 and drop a video in.

The hosted build has a size and length limit per video (configurable in `.env.netlify`), because processing happens on the visitor's machine and huge files can overwhelm a weak laptop.

### 2. Desktop, fully offline (recommended for office machines)

The desktop version bundles the llama.cpp engine with the gemma 3 4B vision model. One engine, no choices to make, no Ollama, no admin rights. See [desktop/README.md](desktop/README.md) for the three step setup. Build it with:

```
npm run build:desktop
```

## How it works

1. Frames are sampled adaptively across the video and fingerprinted, so step boundaries follow actual screen changes rather than the clock
2. Audio is decoded at 16 kHz, denoised and transcribed with Whisper (small), with meeting chatter filtered out of the transcript
3. Tesseract reads on screen text with a confidence filter, so garbled UI text never reaches the document
4. The recording start is detected: webcam only intro minutes can not produce fabricated steps
5. Each segment goes to the model with the transcript, the screen text and the screenshot together, and the model must describe what it sees before it may decide the segment has no step in it
6. Verification, deduplication and consolidation passes clean the result
7. A document level pass writes the purpose, summary and FAQ, grounded in the same evidence

## Deploying to Netlify

The repo is ready as is: `netlify.toml` sets the build command, SPA redirects, the cross origin isolation headers needed for multithreaded WASM, and long lived caching for the heavy runtime assets. Connect the repo in Netlify and deploy. Nothing else to configure.

## Privacy

| Data | Where it goes |
|---|---|
| Your video | stays on your machine |
| Audio and transcript | processed in the browser |
| Screenshots | processed locally by the model |
| Exports | written straight to your disk |

The only network traffic is the one time download of the AI models themselves.

## Tech stack

React, Vite, Tailwind. Whisper via transformers.js, OCR via Tesseract.js, in browser AI via WebLLM, desktop AI via llama.cpp with gemma 3, exports via jsPDF and docx, diagrams via Mermaid.

## License

MIT
