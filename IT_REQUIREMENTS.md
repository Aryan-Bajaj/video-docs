# VideoDoc Desktop — IT Requirements & Approval Sheet

**What it is:** a desktop app that turns a screen recording into step-by-step
documentation. The AI runs **entirely on the user's computer** (bundled, offline).
There is **no cloud, no account, no data upload**.

---

## 1. Hardware

| | Minimum | Recommended |
|---|---|---|
| **RAM** | 8 GB | **16 GB** |
| **Free disk** | 6 GB | 10 GB |
| **GPU** | Not required (runs on CPU) | Any dedicated GPU (e.g. 4 GB+) speeds it up |
| **CPU** | 64-bit, 4 cores | 6+ cores |

> The app installs to ~4.5 GB (app + AI model). The model uses ~4–6 GB RAM while
> generating; the GPU is used if present, otherwise the CPU.

## 2. Operating system / software

- **Windows 10 or 11 (64-bit)** — primary. (macOS build also possible.)
- **Microsoft Edge WebView2** — already built into Windows 11; auto-present on most
  Windows 10. (Standard Microsoft component.)
- No .NET, Java, Python, or other runtimes required — everything is bundled.

## 3. Installation & permissions

- Ships as a **signed installer** (`.msi` / `.exe`).
- Can be packaged as **per-user install → NO admin rights needed** (good for locked-down machines), or system-wide if IT prefers.
- Installs only to the user/app folder. No drivers, no system services, no registry-wide changes.

## 4. Network & security  *(the important part for IT)*

| Activity | Network used? | Destination |
|---|---|---|
| **Generating documentation (normal use)** | **None** | — runs 100% locally |
| **AI model download** *(only if not bundled in installer)* | One-time HTTPS | `huggingface.co` (or our CDN) |
| **App auto-update** *(optional — can be disabled)* | Occasional HTTPS | our update server |
| **Internal AI engine** | Loopback only | `127.0.0.1:8080` — never leaves the device |

**Key points for security review:**
- **No outbound data.** The video, screenshots, audio and transcript are **never
  sent anywhere**. Nothing is uploaded.
- **No telemetry, no analytics, no account/login.**
- The AI talks to a **localhost (127.0.0.1) loopback** server inside the app — this
  is the computer talking to itself; it needs **no inbound firewall rule** and is not
  reachable from the network.
- For a **fully air-gapped / offline** deployment: choose the **model-bundled
  installer** and **disable auto-update** → the app makes **zero network connections, ever.**
- The bundled local-inference binary (`llama-server.exe`) is open-source
  (llama.cpp). It may need to be **allow-listed in EDR/antivirus** (standard for any
  new signed app running a local process).

## 5. Privacy / compliance

- All processing is **on-device**. Suitable for confidential / regulated data
  (the app never transmits the content it processes).
- No personal data is collected or transmitted by the app.
- Open-source components (llama.cpp, Whisper, Tesseract) — auditable.

---

## ✅ Ask your IT team to confirm these 6 items

1. **Disk:** ~6 GB free on the target machines — OK?
2. **RAM:** 8 GB minimum (16 GB ideal) — OK?
3. **Install method:** is a **per-user signed installer** (no admin) acceptable, or do they require system-wide / their own packaging (SCCM/Intune)?
4. **App allow-listing:** can the signed app + its local `llama-server.exe` be **allow-listed in antivirus/EDR**?
5. **Localhost server:** is a **127.0.0.1-only** local server (loopback, no external port) permitted by endpoint policy?
6. **Offline vs download:** do they want the **fully-offline build** (model bundled, no network) — or is a one-time HTTPS model download from a trusted source allowed?

> If IT says "no new installs at all," the **browser version** (no install, runs in
> Chrome/Edge) is the fallback — but it's limited to smaller models and lower accuracy.
