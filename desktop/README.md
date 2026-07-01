# VideoDoc Desktop

Run VideoDoc fully offline with a built in vision model. No Ollama, no browser AI downloads, no admin rights needed. Made for office laptops.

## One time setup

1. Copy this `desktop` folder anywhere on the target machine (USB stick works).
2. Open PowerShell in the folder and run:

   ```
   powershell -ExecutionPolicy Bypass -File get-engine.ps1
   ```

   This downloads the llama.cpp engine (Vulkan build, works on NVIDIA, AMD and Intel graphics with CPU fallback) and the gemma 3 4B vision model (about 4 GB total). Internet is only needed for this step.

3. Build the app into the `app` subfolder (done once by whoever prepares the bundle):

   ```
   npm run build:desktop
   ```

   then copy the contents of `dist-desktop` into `desktop\app`.

## Daily use

Double click `VideoDoc.bat`. It starts the local engine, opens the browser, and you can drop a video straight in. Keep the black window open while you work.

## What runs where

| Part | Where it runs |
|---|---|
| Transcription (Whisper) | in your browser |
| Screen text reading (OCR) | in your browser |
| AI writing (gemma 3, vision) | llama.cpp on localhost |
| Your video | never leaves the machine |

## Folder layout after setup

```
desktop/
  VideoDoc.bat        launcher
  get-engine.ps1      one time downloader
  llama/              engine binaries
  models/             gemma 3 model + vision projector
  app/                the built web app
```
