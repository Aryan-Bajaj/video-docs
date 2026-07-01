# VideoDoc Desktop

The desktop version bundles the llama.cpp engine with the gemma 3 4B vision model, so it runs fully offline with a single AI backend and nothing to install beyond copying a folder.

Setup, daily use and the folder layout are documented in [desktop/README.md](desktop/README.md).

In short:

1. `npm run build:desktop`, then copy `dist-desktop` into `desktop/app`
2. On the target machine, run `desktop/get-engine.ps1` once (downloads the engine and the model, about 4 GB)
3. Start with `desktop/VideoDoc.bat`

How it works: the launcher starts `llama-server` on `http://localhost:8080`, which hosts both the app files and an OpenAI compatible, vision capable API. The app detects it and selects the built in engine automatically (`src/lib/llm.js`, `callLocalEngine` and `localEngineStatus`). All inference is local; localhost traffic is the computer talking to itself.

For IT and security review of what the bundle contains and downloads, see [WHATS_INSIDE.md](WHATS_INSIDE.md) and [IT_REQUIREMENTS.md](IT_REQUIREMENTS.md).

A single installer (`.exe` via Tauri) is planned as a later packaging step; the folder bundle above is the current supported path.
