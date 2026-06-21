# Changelog

All notable changes to VideoDoc, version by version. Newest first.

## v3 — Sees and hears, like a person (current)

The biggest leap yet. The AI now watches the screen and hears every word, so a recording becomes a real Desktop Procedure you can follow without opening the video.

* **Vision.** The AI sees the actual screenshots (gemma3 via Ollama, or Phi-3.5-Vision in the browser), not just OCR text. It names exact buttons and works out "click here" by looking.
* **Whisper Small.** A far more accurate transcript: names, accents and technical jargon.
* **A real Desktop Procedure.** Index, Purpose, Prerequisites, numbered steps (action, result, note, screen capture), Key Observations, Executive Summary, FAQ, and a flow diagram.
* **Sharp WebM step clips.** True colour, clearer and smaller than GIFs, inlined into the self-contained HTML.
* **Smarter steps.** One clean step per segment, off-topic and silent stretches skipped, duplicates merged. A one-hour video reads as roughly 30 to 35 steps, not 48 fragments.
* **Steps say WHERE.** Each action names the app, ribbon, tab or menu, not just the element.
* **RAG-grounded FAQ.** Diverse questions from the discussion, each answer retrieved from the transcript and enriched with the model's general knowledge, without inventing specifics.
* **Clean phased flow diagram**, **hidden transcript for AI tools**, **stronger model picker**, **faster and safer pipeline** (cancel, progress bar, no stalls), and **domain mishearing fixes**.

## v2 — Eyes, motion, and chat

* **OCR** reads on-screen text; tools (Excel, SAP, VBA and more) are auto-detected.
* **Animated step GIFs** of the real action.
* **Vid Chat (RAG):** ask your recording questions, with grounded answers and the matching frame.
* **Chunking** for long videos, with whole-video coverage.
* **You name the guide**, a browser-first **model picker**, and a standalone **Doc Chat** app.

## v1 — The basics

* Transcribe a recording and grab frames every few seconds.
* One LLM call per segment to write the steps.
* A few static screenshots per step.
* Export to HTML.
