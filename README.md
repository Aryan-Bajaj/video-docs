# 🎬 VideoDoc

**Automated Video Documentation · AI Transcription · Local LLM Annotation · Beautiful Exports**

`React` `Whisper AI` `Ollama` `WebLLM` `OCR` `RAG` `Three.js` `Vite` `License: MIT` `Version 2`

> Turn any screen recording into polished, step-by-step documentation, entirely in your browser. No server. No uploads. No subscription. Ever.

> **Now on Version 2.** It reads the screen with OCR, builds animated step GIFs, covers the whole video with chunking, and adds **Vid Chat** and a standalone **Doc Chat** app. Every v2 addition is marked **🆕 New in v2** throughout this document. See [New in v2](#-new-in-v2).

---

## 📑 Table of Contents

1. [What Is This?](#-what-is-this)
2. [Live Demo](#-live-demo)
3. [New in v2](#-new-in-v2) `🆕`
4. [How It Works: The Full Pipeline](#-how-it-works-the-full-pipeline)
5. [Module Breakdown](#-module-breakdown)
   - [Module 1: Frame Extraction](#module-1-frame-extraction)
   - [Module 2: Audio Extraction](#module-2-audio-extraction)
   - [Module 3: Whisper AI Transcription](#module-3-whisper-ai-transcription)
   - [Module 4: AI Annotation (Ollama / WebLLM)](#module-4-ai-annotation-ollama--webllm)
   - [Module 5: Export Engine](#module-5-export-engine)
   - [Module 6: Read Screen with OCR](#module-6-read-screen-with-ocr) `🆕 v2`
   - [Module 7: Animated Step GIFs](#module-7-animated-step-gifs) `🆕 v2`
   - [Module 8: Chunking and Whole-Video Coverage](#module-8-chunking-and-whole-video-coverage) `🆕 v2`
   - [Module 9: Vid Chat (in-browser RAG)](#module-9-vid-chat-in-browser-rag) `🆕 v2`
   - [Module 10: Doc Chat app](#module-10-doc-chat-app) `🆕 v2`
6. [Repository Structure](#-repository-structure)
6. [Tech Stack](#-tech-stack)
7. [Getting Started](#-getting-started)
8. [Deploying to Netlify](#-deploying-to-netlify)
9. [Privacy: Where Does Your Data Go?](#-privacy-where-does-your-data-go)
10. [Customisation](#-customisation)
11. [License Notes](#-license-notes)
12. [Author](#-author)
13. [License](#-license)

---

## 📖 What Is This?

Imagine you just finished recording a 10-minute tutorial: a code walkthrough, a product demo, an onboarding video, a design process, anything.
Now someone says: *"Can you write this up as a step-by-step guide?"*

You sigh. You open a doc. You rewatch the video. You pause. You type. You pause again.
Two hours later you have a half-finished document you never want to look at again.

**VideoDoc eliminates that entirely.**

Upload the video. Click annotate. Get a polished, structured, beautifully formatted document, with screenshots, numbered steps, and AI-written annotations, in minutes.

It works for:

* 👨‍💻 **Developers** recording code walkthroughs → instant onboarding docs
* 👩‍🏫 **Educators** recording lessons → exportable step-by-step guides
* 📋 **Operations and PMs** recording workflows → SOPs ready to share
* 🎨 **Designers and Creators** recording process videos → polished case studies

And the best part? **Everything runs in your browser.** No API keys. No cloud. No privacy trade-offs.

P.S. — This is Version 2. I’m currently working on Version 3 to improve the overall documentation quality.
---

## 🌐 Live Demo

👉 **[videodoc.netlify.app](https://videodoc.netlify.app)**

* `/` is the landing page
* `/#/app` is the VideoDoc app (video to documentation)
* `/#/docchat` is the Doc Chat app (upload a document and chat with it)

---

## ✨ New in v2

Everything below runs client-side. No server, no API keys.

* **Reads your screen (OCR).** Tesseract reads the on-screen text off the frames, so steps name the exact buttons, menus and files, and the tools you used (Excel, VBA, SAP, VS Code, Python and more) are detected automatically and listed in the guide.
* **Animated step GIFs.** Each step becomes a smooth GIF of the real action: a clip from 3 seconds before to 3 seconds after the keyframe, encoded in the browser with `gifenc` and embedded into the HTML guide. Optimised with downscaling, low frame rate and a shared palette.
* **Vid Chat (RAG).** Ask your recording questions, either after a full guide is built or right after transcription. Embeddings run in the browser (MiniLM via `transformers.js`), the closest moments are retrieved, and the local LLM answers, showing the matching frame and a jump-to-moment link.
* **Handles long videos (chunking) and covers the whole video.** The recording is split into time windows across its full length, not just where someone spoke, so silent stretches are still documented from the on-screen (OCR) text. Long recordings finish in a handful of focused passes instead of hundreds of tiny calls. Frame extraction auto-caps and downscales to stay within browser memory.
* **You name the guide.** The document title is asked up front, so the heading is never the raw video file name.
* **Browser-first by default.** WebLLM runs Llama 3.2 3B (falls back to 1B) so anyone can use it with zero install. Ollama stays available as an opt-in upgrade for stronger local models.
* **Two apps, one project.** **VideoDoc** turns a recording into a guide and lets you Vid Chat with it. **Doc Chat** lets you upload a document directly, chunk it, and chat with it, no video required. Both are reachable from the landing page.
* **Resilient by design.** The animated background is wrapped so a missing WebGL context (low-end devices, hardware acceleration off) can never blank the page. Verified by an automated headless render test of every route.

---

## 🔄 How It Works: The Full Pipeline

**App 1: VideoDoc (video → guide)**

```
┌─────────────┐   ┌──────────────────────┐   ┌─────────────────────┐   ┌──────────────────────┐
│  Upload     │──▶│  Extract             │──▶│  Whisper AI          │──▶│  Read Screen (OCR)   │
│  Video      │   │  Frames + Audio      │   │  Transcription       │   │  on-screen text +    │
│  (.mp4/.mov │   │  (auto-capped,       │   │  (Web Worker,        │   │  tools detected      │
│  /.webm)    │   │  downscaled)         │   │  ~95% accuracy)      │   │  (Excel, VBA, SAP…)  │
└─────────────┘   └──────────────────────┘   └──────────────────────┘   └──────────┬───────────┘
                                                                                    │
        ┌───────────────────────────────────────────────────────────────────────────┘
        │
┌───────▼──────────────────────────────────────────────────────────┐
│   Chunk transcript into time windows (covers the WHOLE video)     │
│   then AI Annotation (auto-detected)                              │
│   ┌──────────────────────┐    ┌──────────────────────────────┐   │
│   │  Ollama found?       │    │  WebLLM fallback             │   │
│   │  localhost:11434     │    │  Llama-3.2-3B via WebGPU     │   │
│   │  ✅ stronger models  │    │  ✅ no install (browser)     │   │
│   └──────────────────────┘    └──────────────────────────────┘   │
└───────────────────────────────┬──────────────────────────────────┘
                                 │
       ┌─────────────────────────┴───────────────────────────┐
       │                                                      │
┌──────▼──────────────────────────────┐        ┌──────────────▼───────────────┐
│         Export Engine               │        │   Vid Chat (in-browser RAG)  │
│  🌐 HTML (animated step GIFs)       │        │   ask the guide, get answers │
│  📄 PDF        📝 DOCX              │        │   + matching frame + jump    │
└─────────────────────────────────────┘        └──────────────────────────────┘
```

**App 2: Doc Chat (document → chat)**

```
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────────────┐
│  Upload a document   │──▶│  Extract text +      │──▶│  Doc Chat (in-browser RAG)   │
│  .txt .md .html .docx│   │  chunk (big docs OK) │   │  MiniLM embeddings + answers │
└──────────────────────┘   └──────────────────────┘   └──────────────────────────────┘
```

---

## 🧩 Module Breakdown

### Module 1: Frame Extraction

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

### Module 2: Audio Extraction

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

### Module 3: Whisper AI Transcription

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

### Module 4: AI Annotation (Ollama / WebLLM)

Once transcription is done, VideoDoc sends each segment to a **local LLM** for annotation. The LLM writes structured step-by-step documentation for each segment.

VideoDoc **auto-detects** which AI to use:

#### 🟢 Path A: Ollama (Recommended)

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

#### 🟣 Path B: WebLLM (Fallback)

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

### Module 5: Export Engine

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
// Dynamic import, only loaded when user clicks Export
const { exportHTML } = await import('./lib/exportHTML.js')
exportHTML(annotatedDocs, frames, videoName)
```

#### 📄 PDF Export

Clean, readable, print-friendly layout via `jspdf`.

#### 📝 DOCX Export

Word-compatible document via the `docx` package. Paste directly into Notion, Confluence, or Google Docs.

---

### Module 6: Read Screen with OCR

**🆕 New in v2.** After frames are captured, `tesseract.js` reads the actual on-screen text directly off the frames (sampled and bounded so it stays fast). That text is fed to the LLM so steps name the exact buttons, menus and files, and a signature scan detects the tools used (Excel, VBA, SAP, VS Code, Python and more) which are then listed in the guide.

| Parameter | Value |
|---|---|
| Engine | tesseract.js (in browser) |
| Frames read | sampled, capped for speed |
| Output | on-screen text per frame + detected tools |

---

### Module 7: Animated Step GIFs

**🆕 New in v2.** Each documented step becomes a short GIF of the real action: a clip from 3 seconds before to 3 seconds after the keyframe, captured by seeking a hidden `<video>` and encoded with `gifenc`. Optimised with downscaling, a low frame rate and a single shared colour palette, then embedded into the HTML guide in place of a static screenshot.

---

### Module 8: Chunking and Whole-Video Coverage

**🆕 New in v2.** The transcript is split into time windows across the full length of the video, not just where someone spoke. Silent stretches are still documented from the OCR text. This keeps long recordings coherent (a handful of focused passes instead of hundreds of tiny calls) and bounds the number of LLM requests.

---

### Module 9: Vid Chat (in-browser RAG)

**🆕 New in v2.** Ask the finished guide questions. Each segment is embedded with MiniLM (`@huggingface/transformers`, runs in the browser), the closest segments to the question are retrieved by cosine similarity, and the local LLM answers grounded in those segments, showing the matching frame and a jump-to-moment link. No server, no API keys.

---

### Module 10: Doc Chat app

**🆕 New in v2.** A second app (at `/#/docchat`). Upload a document (`.txt`, `.md`, `.html`, `.docx`); the text is extracted and chunked into overlapping passages so even large documents index cleanly, then the same in-browser RAG lets you chat with it. No video required.

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
│   ├── _headers                  ← COEP/COOP for drag-drop deploys   🆕 v2
│   ├── three.min.js              ← Three.js r134 (same-origin, bypasses COEP)
│   ├── vanta.halo.min.js         ← Vanta HALO effect (app background)
│   └── vanta.net.min.js          ← Vanta NET effect (landing background)
│
└── src/
    ├── main.jsx                  ← HashRouter → / · /app · /docchat       🆕 v2 route
    ├── App.jsx                   ← VideoDoc pipeline UI + OCR + Vid Chat
    ├── DocChatApp.jsx            ← Doc Chat app (upload a doc, chat)      🆕 v2
    ├── index.css                 ← Indeterminate progress animation
    │
    ├── components/
    │   ├── LandingPage.jsx       ← Full landing page (two app buttons)
    │   ├── Uploader.jsx          ← Drop cards: video / code / reference doc
    │   ├── VideoPlayer.jsx       ← Seekable video preview
    │   ├── FrameStrip.jsx        ← Horizontal frame timeline
    │   ├── DocPreview.jsx        ← Live transcript + annotation viewer
    │   ├── ExportBar.jsx         ← HTML / PDF / DOCX export (+ GIFs)
    │   ├── AISettings.jsx        ← Title + Ollama model picker + sections
    │   ├── DocChat.jsx           ← Vid Chat / Doc Chat panel             🆕 v2
    │   ├── DocChatDemo.jsx       ← Looping Vid Chat landing animation     🆕 v2
    │   ├── ProductDemo.jsx       ← Animated landing-page product demo
    │   ├── BeforeAfter.jsx       ← Before/after comparison slider
    │   ├── VideoDocLogo.jsx      ← Custom SVG logo
    │   └── PipelineStatus.jsx    ← Live step tracker (elapsed, %, ETA)
    │
    ├── hooks/
    │   ├── useFrameExtractor.js  ← Frame extraction (capped + downscaled) 🆕 v2 hardening
    │   ├── useAudioExtractor.js  ← Web Audio API → 16kHz (guarded)        🆕 v2 hardening
    │   ├── useTranscriber.js     ← Whisper Web Worker wrapper
    │   ├── useAnnotator.js       ← Windowed annotation + OCR context      🆕 v2
    │   ├── useOCR.js             ← Tesseract OCR + tool detection         🆕 v2
    │   ├── useGifMaker.js        ← Browser GIF encoding per step          🆕 v2
    │   ├── useRAG.js             ← In-browser embeddings + retrieval      🆕 v2
    │   ├── useDocParser.js       ← headings + full-text extract + chunk   🆕 v2 (chunk)
    │   └── useVantaHalo.js       ← Vanta HALO background (WebGL-guarded)   🆕 v2 hardening
    │
    ├── workers/
    │   └── transcriber.worker.js ← Whisper in isolated Web Worker thread
    │
    └── lib/
        ├── llm.js                ← Shared Ollama + WebLLM calls           🆕 v2
        ├── skillPrompt.js        ← OCR-aware prompts + window chunking    🆕 v2
        ├── exportHTML.js         ← HTML guide (title, tools, step GIFs)
        ├── exportPDF.js          ← jsPDF export (title + tools)
        └── exportDOCX.js         ← docx export (title + tools)
```

---

## 🛠️ Tech Stack

| Tool / Library | Role |
|---|---|
| **React 18 + Vite 6** | Frontend framework + build tool |
| **Tailwind CSS v4** | Utility-first styling |
| **@huggingface/transformers v4** | Whisper transcription + MiniLM embeddings (RAG), in browser via ONNX |
| **@mlc-ai/web-llm** | WebLLM, Llama 3.2 3B/1B via WebGPU |
| **Ollama** | Local LLM server (optional, user-installed) |
| **tesseract.js** | In-browser OCR (on-screen text + tool detection) |
| **gifenc** | In-browser GIF encoding for animated step clips |
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
git clone https://github.com/Aryan-Bajaj/video-docs.git
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

### Option A: Drag and Drop (No Git required)

```bash
npm run build
# Drag the dist/ folder to https://app.netlify.com/drop
```

### Option B: Connect GitHub Repo

1. Push this repo to GitHub
2. Connect it to Netlify
3. Set build command: `npm run build` and publish directory: `dist`
4. Netlify reads `netlify.toml` automatically for COEP/COOP headers

> **Why COEP/COOP headers?** Whisper uses `SharedArrayBuffer` (for WASM threading) which browsers only allow on pages with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Both are set in `netlify.toml`.

---

## 🔒 Privacy: Where Does Your Data Go?

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
In `src/components/LandingPage.jsx`, find the `window.VANTA.NET({...})` call and adjust `color`, `points`, `maxDistance`, `spacing`.

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

**Aryan Bajaj** · [GitHub](https://github.com/Aryan-Bajaj)

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
