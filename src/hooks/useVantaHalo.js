import { useEffect, useRef } from 'react'

export default function useVantaHalo() {
  const ref = useRef(null)
  const effect = useRef(null)

  useEffect(() => {
    if (!ref.current || !window.VANTA?.HALO) return
    let t
    // WebGL can fail (no GPU, hardware acceleration off, low-end device).
    // Never let that crash the page — the background is purely decorative.
    try {
      const isMobile = window.innerWidth <= 640
      effect.current = window.VANTA.HALO({
        el: ref.current,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: window.innerHeight,
        minWidth: window.innerWidth,
        backgroundColor: 0x0d0d2b,
        baseColor: 0x1a3a7a,
        size: isMobile ? 1.3 : 2.8,
        amplitudeFactor: isMobile ? 1.0 : 0.6,
        speed: 0.3,
        xOffset: 0,
        yOffset: 0,
      })
      t = setTimeout(() => { try { effect.current?.resize() } catch {} }, 150)
    } catch (e) {
      console.warn('Vanta background disabled (no WebGL):', e?.message)
    }
    return () => { clearTimeout(t); try { effect.current?.destroy() } catch {} ; effect.current = null }
  }, [])

  return ref
}
