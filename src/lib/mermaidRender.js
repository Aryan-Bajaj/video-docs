// Render a Mermaid definition to a static SVG string at export time, so the
// exported HTML contains a plain inline <svg> — no mermaid runtime, no CDN, no
// JavaScript, no network. Fully offline + private, renders instantly.
let mermaidMod = null
let inited = false

export async function renderMermaidSVG(def) {
  if (!def || !def.trim()) return ""
  try {
    if (!mermaidMod) mermaidMod = (await import("mermaid")).default
    if (!inited) {
      mermaidMod.initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "strict",
        flowchart: { useMaxWidth: true, htmlLabels: false, curve: "basis" },
        fontFamily: "DM Sans, sans-serif",
      })
      inited = true
    }
    const id = "mmd" + Math.random().toString(36).slice(2)
    const { svg } = await mermaidMod.render(id, def)
    return svg
  } catch {
    return "" // invalid diagram → caller simply omits the flow section
  }
}

// Rasterise a mermaid SVG string to a white-background PNG data URL, for the
// PDF / DOCX exports (which can't embed live SVG). Best-effort: returns "" on
// any failure so the export still succeeds without the diagram.
export async function svgToPngDataURL(svg, scale = 2) {
  if (!svg || !svg.trim()) return ""
  try {
    // mermaid SVGs size via viewBox + style max-width and often lack explicit
    // width/height → set them so the image rasterises at real dimensions.
    let w = 900, h = 500
    const vb = svg.match(/viewBox="([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)"/i)
    if (vb) { w = Math.ceil(+vb[3]); h = Math.ceil(+vb[4]) }
    const sized = svg
      .replace(/(<svg[^>]*?)\s(?:width|height)="[^"]*"/gi, "$1")
      .replace(/<svg /i, `<svg width="${w}" height="${h}" `)

    const blob = new Blob([sized], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
    const canvas = document.createElement("canvas")
    canvas.width = w * scale
    canvas.height = h * scale
    const ctx = canvas.getContext("2d")
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url)
    return { dataUrl: canvas.toDataURL("image/png"), width: w, height: h }
  } catch {
    return ""
  }
}
