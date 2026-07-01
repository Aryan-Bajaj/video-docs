// Build-time video limits. The hosted (Netlify) build sets these via env; the
// desktop build leaves them unset = unlimited. Processing is 100% in-browser,
// so these guard the USER'S machine (RAM / GPU / tab stability), not the server
// — a huge video can't hurt the site, but it can crash a weak laptop's browser
// tab mid-pipeline, and that failure lands on us.
export const MAX_VIDEO_MB = Number(import.meta.env.VITE_MAX_VIDEO_MB || 0)   // 0 = unlimited
export const MAX_VIDEO_MIN = Number(import.meta.env.VITE_MAX_VIDEO_MIN || 0) // 0 = unlimited

// Synchronous size check — cheap, runs before anything touches the file.
export function checkVideoSize(file) {
  if (MAX_VIDEO_MB && file.size > MAX_VIDEO_MB * 1024 * 1024) {
    return `This video is ${(file.size / 1048576).toFixed(0)} MB — the online version accepts up to ${MAX_VIDEO_MB} MB. Trim the recording, or use the desktop app (no limits).`
  }
  return null
}

// Duration check via metadata only (no decode). Resolves null when fine or
// when the duration can't be read — an unreadable file should fail in the
// pipeline with a real error, not be blocked here on a guess.
export function checkVideoDuration(file) {
  return new Promise((resolve) => {
    if (!MAX_VIDEO_MIN) return resolve(null)
    const v = document.createElement("video")
    v.preload = "metadata"
    v.onloadedmetadata = () => {
      const dur = v.duration
      URL.revokeObjectURL(v.src)
      resolve(isFinite(dur) && dur > MAX_VIDEO_MIN * 60
        ? `This recording is ${Math.round(dur / 60)} min — the online version accepts up to ${MAX_VIDEO_MIN} min. Split the video, or use the desktop app (no limits).`
        : null)
    }
    v.onerror = () => { URL.revokeObjectURL(v.src); resolve(null) }
    v.src = URL.createObjectURL(file)
  })
}
