import { useEffect, useRef } from 'react'

export default function useVantaHalo() {
  const ref = useRef(null)
  const effect = useRef(null)

  useEffect(() => {
    if (!ref.current || !window.VANTA?.HALO) return
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
      // Smaller rings + stronger amplitude on phones so the halo
      // stays on-screen and reads clearly instead of falling off the edges
      size: isMobile ? 1.3 : 2.8,
      amplitudeFactor: isMobile ? 1.0 : 0.6,
      speed: 0.3,
      xOffset: 0,
      yOffset: 0,
    })
    // Force full-screen resize after mount
    const t = setTimeout(() => effect.current?.resize(), 150)
    return () => { clearTimeout(t); effect.current?.destroy(); effect.current = null }
  }, [])

  return ref
}
