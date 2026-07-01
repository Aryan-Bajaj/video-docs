// In-browser system probe for recommending an in-browser (WebLLM) model.
// Everything here is client-side — it runs in whatever browser/device the user
// is on (Windows, macOS, iOS, Android), since that is where the model will load.
//
// The honest, reliable signals available in a browser are:
//   • WebGPU present?  → the hard gate; without it WebLLM cannot run at all.
//   • GPU name/vendor  → discrete (NVIDIA/AMD/Arc) vs integrated → strength.
//   • deviceMemory     → approximate system RAM (Chrome; capped at 8).
//   • adapter limits   → coarse VRAM proxy (no risky allocation).
// We map these to an estimated "capacity" in GB that a model must fit under.

function detectOS() {
  const u = navigator.userAgent || ""
  const p = navigator.platform || ""
  if (/iPhone|iPad|iPod/.test(u) || (p === "MacIntel" && navigator.maxTouchPoints > 1)) return "iOS"
  if (/Android/.test(u)) return "Android"
  if (/Mac/.test(u)) return "macOS"
  if (/Win/.test(u)) return "Windows"
  if (/Linux/.test(u)) return "Linux"
  return "your device"
}

// Best-effort GPU name from the WebGPU adapter (newer browsers expose adapter.info;
// older ones need requestAdapterInfo()).
async function gpuInfoOf(adapter) {
  try {
    if (adapter.info) return adapter.info
    if (adapter.requestAdapterInfo) return await adapter.requestAdapterInfo()
  } catch { /* ignore */ }
  return {}
}

// Returns { webgpu, os, ram, cores, gpuName, discrete, capacityGB, fallback }.
// capacityGB is the rough amount of model we think this device can load.
export async function probeSystem() {
  const os = detectOS()
  const ram = navigator.deviceMemory || null          // GB, Chrome-only, capped at 8
  const cores = navigator.hardwareConcurrency || null
  const base = { os, ram, cores, webgpu: false, gpuName: null, discrete: false, capacityGB: 0, fallback: false }

  if (!navigator.gpu) return base

  let adapter = null
  try { adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" }) } catch { /* ignore */ }
  if (!adapter) return base

  const info = await gpuInfoOf(adapter)
  const gpuName = (info.description || info.architecture || info.vendor || "").trim() || null
  const discrete = /nvidia|geforce|rtx|gtx|radeon|\brx ?\d|amd|intel\(r\) arc|\barc\b/i.test(gpuName || "")
  const fallback = !!adapter.isFallbackAdapter

  // Coarse capacity estimate from reliable signals (no GPU allocation gymnastics).
  let capacityGB = 1.5
  if (fallback) capacityGB = 0.8                                   // software renderer → very weak
  else if (discrete && (ram == null || ram >= 8)) capacityGB = 4    // dedicated GPU + decent RAM
  else if (discrete) capacityGB = 3
  else if (ram == null || ram >= 8) capacityGB = 2.5               // integrated but healthy RAM
  else capacityGB = 1.5                                            // weak / mobile

  // iOS Safari caps WebGPU buffers hard — keep expectations low regardless.
  if (os === "iOS") capacityGB = Math.min(capacityGB, 1.5)

  return { ...base, webgpu: true, gpuName, discrete, capacityGB, fallback }
}
