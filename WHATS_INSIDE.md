# VideoDoc Desktop — What's inside, how it works, what it downloads

A transparency / "software bill of materials" sheet for IT & security review.
**Summary:** everything runs on the user's machine. The only data that ever crosses
the network is software/models coming *to* the user — never the user's content.

---

## 1. What's inside (components used)

| Component | What it does | License | Open-source |
|---|---|---|---|
| **Tauri** (Rust) | The app window/shell. Uses the OS's built-in WebView, so it stays small. | MIT / Apache-2.0 | Yes |
| **React + Vite** | The user interface you see. | MIT | Yes |
| **llama.cpp** (`llama-server`) | The local AI **engine** that runs the language model on your CPU/GPU. | MIT | Yes |
| **gemma3** (Google) | The **AI model** that writes the documentation. Multimodal — it can read screenshots. | Gemma Terms (open weights) | Open weights |
| **Whisper** (OpenAI) | Converts the video's **audio → transcript**. | MIT | Yes |
| **Transformers.js** (Hugging Face) | Runs the Whisper model inside the app (no server). | Apache-2.0 | Yes |
| **Tesseract.js** | **OCR** — reads the text shown on screen in each frame. | Apache-2.0 | Yes |
| jsPDF / docx / Mermaid | Export to PDF / Word, and draw the flow diagram. | MIT | Yes |

> Every AI component is **open-source and auditable**. None of them "phone home."

## 2. How it works (data flow — step by step)

```
   Your video file
        │  (read locally — never uploaded)
        ▼
 ① Extract frames        → screenshots                  [on your machine]
 ② Extract + denoise audio → Whisper → transcript        [on your machine]
 ③ Tesseract OCR reads on-screen text from frames        [on your machine]
        │
        ▼
 ④ gemma3 (via llama.cpp) reads transcript + screen text
    + screenshots  →  writes the step-by-step guide       [on your machine]
        │
        ▼
 ⑤ You review & edit  →  ⑥ Export to PDF / HTML / Word    [on your machine]
```

**At no step does your video, audio, screenshots or text leave the computer.**
The app and the AI engine communicate over `127.0.0.1` (loopback) — internal only.

## 3. What it downloads (and from where)

There are **two ways to ship** — IT chooses:

**A) Model bundled in the installer (recommended for offline / regulated environments)**
- Downloads: **nothing.** The installer already contains the AI models.
- The app makes **zero network connections** (with auto-update disabled).

**B) Model downloaded on first run (smaller installer)**

| Downloaded once, then cached forever | Approx size | From |
|---|---|---|
| gemma3 model + vision projector | ~3.5 GB | `huggingface.co` (or our CDN), over HTTPS |
| Whisper model (speech-to-text) | ~1 GB | `huggingface.co` / CDN, HTTPS |
| Tesseract OCR language data (English) | ~10 MB | CDN, HTTPS |

- These are **downloaded to the user once**, then stored locally — never re-downloaded.
- **Only software/models are downloaded — never the user's content.**
- Optional **app auto-update**: an occasional HTTPS check to our update server. Can be turned off for locked-down environments.

## 4. One-line summary for security

> VideoDoc is a self-contained, on-device app. It bundles open-source AI engines
> (llama.cpp, Whisper, Tesseract) and the gemma3 model. User content is processed
> 100% locally and is **never transmitted**. The only network traffic is an optional
> one-time model download and an optional update check — both of which can be
> eliminated by shipping the fully-offline (model-bundled, auto-update-off) build.
