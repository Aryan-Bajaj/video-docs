# 🎬 VideoDoc

**Automated Video Documentation · AI Transcription · Local LLM Annotation · Beautiful Exports**

`React` `Whisper AI` `Ollama` `WebLLM` `Three.js` `Vanta` `Vite` `License: MIT`

> Turn any screen recording into polished, step-by-step documentation — entirely in your browser. No server. No uploads. No subscription. Ever.

---

## 📑 Table of Contents

1. [What Is This?](#-what-is-this)
2. [Live Demo](#-live-demo)
3. [How It Works — The Full Pipeline](#-how-it-works--the-full-pipeline)
4. [Module Breakdown](#-module-breakdown)
   - [Module 1 — Frame Extraction](#module-1--frame-extraction)
   - [Module 2 — Audio Extraction](#module-2--audio-extraction)
   - [Module 3 — Whisper AI Transcription](#module-3--whisper-ai-transcription)
   - [Module 4 — AI Annotation (Ollama / WebLLM)](#module-4--ai-annotation-ollama--webllm)
   - [Module 5 — Export Engine](#module-5--export-engine)
5. [Repository Structure](#-repository-structure)
6. [Tech Stack](#-tech-stack)
7. [Getting Started](#-getting-started)
8. [Deploying to Netlify](#-deploying-to-netlify)
9. [Privacy — Where Does Your Data Go?](#-privacy--where-does-your-data-go)
10. [Customisation](#-customisation)
11. [License Notes](#-license-notes)
12. [Author](#-author)
13. [License](#-license)

---

## 📖 What Is This?

Imagine you just finished recording a 10-minute tutorial — a code walkthrough, a product demo, an onboarding video, a design process, anything.
Now someone says: *"Can you write this up as a step-by-step guide?"*

You sigh. You open a doc. You rewatch the video. You pause. You type. You pause again.
Two hours later you have a half-finished document you never want to look at again.

**VideoDoc eliminates that entirely.**

Upload the video. Click annotate. Get a polished, structured, beautifully formatted document — with screenshots, numbered steps, and AI-written annotations — in minutes.

It works for:

* 👨‍💻 **Developers** recording code walkthroughs → instant onboarding docs
* 👩‍🏫 **Educators** recording lessons → exportable step-by-step guides
* 📋 **Operations and PMs** recording workflows → SOPs ready to share
* 🎨 **Designers and Creators** recording process videos → polished case studies

And the best part? **Everything runs in your browser.** No API keys. No cloud. No privacy trade-offs.

---

## 🌐 Live Demo

👉 **[video-doc.netlify.app](https://video-doc.netlify.app)**

* `/` — Landing page
* `/#/app` — The VideoDoc application

---

## 🔄 How It Works — The Full Pipeline

```
┌─────────────┐     ┌─────────────────────┐     ┌──────────────────────┐
│  Upload     │────▶│  Extract             │────▶│  Whisper AI          │
│  Video      │     │  Frames + Audio      │     │  Transcription       │
│  (.mp4/     │     │  (every 5s JPEG +    │     │  (Web Worker,        │
│  .mov/.webm)│     │  16kHz mono audio)   │     │  ~95% accuracy)      │
└─────────────┘     └─────────────────────┘     └──────────┬───────────┘
                                                            │
                              ┌─────────────────────────────┘
                              │
                    ┌─────────▼──────────────────────────────────────────┐
                    │           AI Annotation (auto-detected)            │
                    │                                                    │
                    │   ┌─────────────────┐    ┌───────────────────┐   │
                    │   │  Ollama found?  │    │  WebLLM fallback  │   │
                    │   │  localhost:     │    │  Llama-3.2-1B     │   │
                    │   │  11434          │    │  via WebGPU       │   │
                    │   │  ✅ RECOMMENDED │    │  ✅ NO INSTALL    │   │
                    │   └─────────────────┘    └───────────────────┘   │
                    └──────────────────────────┬─────────────────────────┘
                                               │
                              ┌────────────────▼────────────────┐
                              │         Export Engine           │
                              │  🌐 HTML  │  📄 PDF  │  📝 DOCX │
                              └─────────────────────────────────┘
```

---

## 🧩 Module Breakdown

### Module 1 — Frame Extraction

VideoDoc uses the **HTML5 Canvas API** and a hidden `<video>` element to pull frames directly in the browser. No server. No ffmpeg. No temp files.

```js
// Seek to timestamp → draw to canvas → export as JPEG
video.currentTime = timestamp
canvas.drawImage(video, 0, 0)
const frame = canvas.toDataURL('image/jpeg', 0.85)
```

| Parameter | Value |
|---|---|
| Interval | Every 5 seconds |
| Format | JPEG (base64) |
| Storage | Browser memory (RAM) |
| Disk writes | Zero |

These frames are later embedded into the exported HTML guide as animated slideshows, one per transcript segment.

---

### Module 2 — Audio Extraction

The audio track is ripped using the **Web Audio API** and **OfflineAudioContext**, then resampled to exactly what Whisper expects.

```js
// Decode → resample to 16kHz mono Float32Array
const audioContext = new OfflineAudioContext(1, length, 16000)
const source = audioContext.createBufferSource()
source.buffer = decoded
source.connect(audioContext.destination)
const resampled = await audioContext.startRendering()
```

| Parameter | Value |
|---|---|
| Output format | Float32Array |
| Sample rate | 16,000 Hz (Whisper standard) |
| Channels | 1 (mono) |
| Storage | Browser memory only |

---

### Module 3 — Whisper AI Transcription

This is where the magic starts. VideoDoc runs **OpenAI's Whisper model** entirely inside your browser using ONNX Runtime Web, powered by `@huggingface/transformers`.

The model runs in a **dedicated Web Worker** so your UI never freezes, even on long videos.

```
Model:    Xenova/whisper-tiny.en
Format:   fp32 (q4/q8 cause MatMulNBits errors in browser ONNX)
Size:     ~150MB (downloaded once, cached in IndexedDB forever)
Output:   Timestamped segments [ { text, start, end }, ... ]
Accuracy: ~95% on clear English audio
```

**First run:** The model downloads (~150MB). Grab a coffee.
**Every run after:** Instant, served from IndexedDB cache.

```
[ Transcription Progress ]
Downloading model  ████████░░  80%   (~120MB / 150MB)
Transcribing       ██████████  100%  → 24 segments found
```

---

### Module 4 — AI Annotation (Ollama / WebLLM)

Once transcription is done, VideoDoc sends each segment to a **local LLM** for annotation. The LLM writes structured step-by-step documentation for each segment.

VideoDoc **auto-detects** which AI to use:

#### 🟢 Path A — Ollama (Recommended)

If Ollama is running on `localhost:11434`, VideoDoc automatically fetches your installed models and lets you pick one.

```
Ping → localhost:11434/api/tags
         ↓ (models found)
Dropdown → llama3.2 / mistral / gemma3 / deepseek-r1 / ...
```

| Metric | Value |
|---|---|
| Output quality | ★★★★★ (full-size model) |
| Privacy | 100% local |
| Speed | Depends on your GPU/CPU |
| Best models | Llama 3.2, Mistral 7B |
| Avoid | Gemma 2 (outputs `<think>` blocks, auto-stripped but messy) |

Each segment gets this prompt structure:

```
Previous context: [prev segment text]
Current segment:  [current text, timestamp]
Next context:     [next segment text]

Write STEPS: 1. ... 2. ... and RESULT: ...
```

Context-aware: the LLM knows what came before and after each segment, so annotations flow naturally as a document.

#### 🟣 Path B — WebLLM (Fallback)

No Ollama? No problem. VideoDoc loads **Llama-3.2-1B-Instruct** directly into your browser via WebGPU using `@mlc-ai/web-llm`.

```
No Ollama detected
    ↓
Loading Llama-3.2-1B-Instruct-q4f32_1-MLC via WebGPU...
    ↓
Model cached in browser after first load
```

| Metric | Value |
|---|---|
| Output quality | ★★★★☆ (smaller model, shorter outputs) |
| Privacy | 100% local (runs in your tab) |
| Speed | WebGPU-dependent |
| Requires | Chrome 113+ / Edge 113+ |

---

### Module 5 — Export Engine

Three export formats, all generated client-side with zero server involvement.

#### 🌐 HTML Export

The crown jewel. A self-contained HTML file with:

* Warm DM Sans typography
* Animated frame slideshow per step (extracted frames, base64 embedded)
* Numbered steps with teal badges
* Gold result rows
* Scroll progress bar
* Scroll-reveal animations
* Fixed navbar
* Fully printable

```js
// Dynamic import — only loaded when user clicks Export
const { exportHTML } = await import('./lib/exportHTML.js')
exportHTML(annotatedDocs, frames, videoName)
```

#### 📄 PDF Export

Clean, readable, print-friendly layout via `jspdf`.

#### 📝 DOCX Export

Word-compatible document via the `docx` package. Paste directly into Notion, Confluence, or Google Docs.

---

## 🗂️ Repository Structure

```
video-docs/
│
├── index.html                    ← Entry point + Three.js/Vanta script tags
├── netlify.toml                  ← COEP/COOP headers + SPA redirect
├── package.json
├── vite.config.js                ← Excludes ONNX/HuggingFace from optimizeDeps
│
├── public/
│   ├── _redirects                ← Netlify SPA fallback
│   ├── three.min.js              ← Three.js r134 (same-origin, bypasses COEP)
│   └── vanta.halo.min.js         ← Vanta HALO effect (same-origin)
│
└── src/
    ├── main.jsx                  ← HashRouter → / (landing) and /app (app)
    ├── App.jsx                   ← VideoDoc pipeline UI + Vanta HALO background
    ├── index.css                 ← Indeterminate progress animation
    │
    ├── components/
    │   ├── LandingPage.jsx       ← Full sci-fi landing page (Vanta NET)
    │   ├── Uploader.jsx          ← 3 drop cards: video / code / reference doc
    │   ├── VideoPlayer.jsx       ← Seekable video preview
    │   ├── FrameStrip.jsx        ← Horizontal frame timeline
    │   ├── DocPreview.jsx        ← Live transcript + annotation viewer
    │   ├── ExportBar.jsx         ← HTML / PDF / DOCX export buttons
    │   ├── AISettings.jsx        ← Ollama model picker + section config
    │   └── PipelineStatus.jsx    ← Live step tracker (elapsed, %, ETA)
    │
    ├── hooks/
    │   ├── useFrameExtractor.js  ← Canvas-based frame extraction
    │   ├── useAudioExtractor.js  ← Web Audio API → 16kHz Float32Array
    │   ├── useTranscriber.js     ← Whisper Web Worker wrapper
    │   ├── useAnnotator.js       ← LLM annotation (Ollama + WebLLM)
    │   ├── useDocParser.js       ← .html/.docx → section headings
    │   └── useVantaHalo.js       ← Vanta HALO background for app page
    │
    ├── workers/
    │   └── transcriber.worker.js ← Whisper in isolated Web Worker thread
    │
    └── lib/
        ├── skillPrompt.js        ← LLM prompt builder + response parser
        ├── exportHTML.js         ← Animated HTML guide generator
        ├── exportPDF.js          ← jsPDF export
        └── exportDOCX.js         ← docx package export
```

---

## 🛠️ Tech Stack

| Tool / Library | Role |
|---|---|
| **React 18 + Vite 6** | Frontend framework + build tool |
| **Tailwind CSS v4** | Utility-first styling |
| **@huggingface/transformers v4** | Whisper AI, runs in browser via ONNX |
| **@mlc-ai/web-llm** | WebLLM, Llama 3.2 via WebGPU |
| **Ollama** | Local LLM server (user-installed) |
| **Three.js r134** | 3D rendering engine for Vanta |
| **Vanta.js** | Animated backgrounds (NET + HALO) |
| **jsPDF** | Client-side PDF generation |
| **docx** | Client-side DOCX generation |
| **mammoth** | .docx to HTML parser (reference docs) |
| **lucide-react** | Icon library |
| **react-router-dom v7** | HashRouter for SPA routing |
| **Netlify** | Hosting (drag dist/ to deploy) |

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/video-docs.git
cd video-docs
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Dev Server

```bash
npm run dev
# Opens at http://localhost:5174
```

> **Note:** The dev server must run with COEP/COOP headers (already configured in `vite.config.js`) for Whisper's SharedArrayBuffer to work.

### 4. (Optional) Set Up Ollama for Best Results

Install Ollama from [ollama.com](https://ollama.com), then pull a model:

```bash
ollama pull llama3.2      # Recommended
ollama pull mistral       # Also great
ollama pull gemma3        # Works fine
```

VideoDoc auto-detects Ollama at `localhost:11434`. No configuration needed.

If Ollama is not running, VideoDoc falls back to WebLLM (Llama 3.2 1B in-browser via WebGPU). Requires Chrome 113+ or Edge 113+.

### 5. Upload a Video and Generate Docs

1. Open `http://localhost:5174`
2. Click **Try It Free** on the landing page
3. Drop a `.mp4`, `.mov`, or `.webm` file
4. Wait for Whisper to transcribe (first run downloads ~150MB model)
5. Select AI mode and model in the annotation modal
6. Click **Annotate**
7. Export as HTML, PDF, or DOCX

---

## ☁️ Deploying to Netlify

### Option A — Drag and Drop (No Git required)

```bash
npm run build
# Drag the dist/ folder to https://app.netlify.com/drop
```

### Option B — Connect GitHub Repo

1. Push this repo to GitHub
2. Connect it to Netlify
3. Set build command: `npm run build` and publish directory: `dist`
4. Netlify reads `netlify.toml` automatically for COEP/COOP headers

> **Why COEP/COOP headers?** Whisper uses `SharedArrayBuffer` (for WASM threading) which browsers only allow on pages with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Both are set in `netlify.toml`.

---

## 🔒 Privacy — Where Does Your Data Go?

| Data | Where it goes |
|---|---|
| Your video file | Browser RAM only. Never leaves your device. |
| Extracted audio | Browser RAM only. Fed directly to Whisper. |
| Extracted frames | Browser RAM. Embedded in export file. |
| Transcript text | Sent to Ollama (localhost) or WebLLM (browser). Never to any server. |
| Exported document | Generated in your browser. Saved to your Downloads folder. |
| **External requests** | **Zero.** Nothing is sent to any external server at runtime. |

The only network request VideoDoc ever makes is to `localhost:11434` (your own Ollama instance) and to download the Whisper model from HuggingFace on first run (cached after that).

---

## ⚙️ Customisation

**Change frame extraction interval**
In `src/App.jsx`, find `extractFrames(file, 5)`. The `5` is seconds between frames.

**Change Whisper model**
In `src/workers/transcriber.worker.js`, replace `Xenova/whisper-tiny.en` with any compatible model (e.g. `Xenova/whisper-base.en` for better accuracy at larger download size).

**Add custom sections to annotation prompt**
In the AI Settings modal, add custom section names. These get injected into the LLM prompt as structured output requirements.

**Change export styling**
Edit `src/lib/exportHTML.js`. All styles are inline in the generated HTML string.

**Change Vanta HALO settings (app background)**
Edit `src/hooks/useVantaHalo.js`. Adjust `baseColor`, `size`, `speed`, `amplitudeFactor`.

**Change Vanta NET settings (landing page background)**
In `src/components/LandingPage.jsx`, find the `NET({...})` call and adjust `color`, `points`, `maxDistance`, `spacing`.

---

## 📄 License Notes

All npm dependencies are MIT, Apache 2.0, or BSD licensed, fully compatible with commercial use.

| Concern | Status |
|---|---|
| All npm packages | ✅ MIT / Apache 2.0 / BSD |
| Whisper model (Xenova) | ✅ MIT |
| WebLLM / Llama 3.2 | ⚠️ Meta Community License. Commercial use allowed under 700M MAU. Must accept [Meta's terms](https://llama.meta.com). |
| Ollama models | User's responsibility. Llama 3.2, Mistral, and Gemma all allow commercial use. |

This project itself is **MIT licensed**. Fork it, build on it, ship it.

---

## ⚠️ Disclaimer

VideoDoc is a browser-based productivity tool. Transcription accuracy depends on audio quality and the Whisper model variant used. AI annotation quality depends on the LLM model chosen. Always review generated documentation before publishing. The tool does not guarantee 100% accuracy on all video types.

---

## 👤 Author

**Aryan Bajaj** — [GitHub](https://github.com/Aryan-Bajaj)

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
