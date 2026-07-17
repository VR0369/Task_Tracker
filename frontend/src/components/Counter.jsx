import { useEffect, useRef, useState } from 'react'

/** Animated integer counter that eases toward `value`. */
export default function Counter({ value = 0, duration = 700, className = '' }) {
  const [display, setDisplay] = useState(0)
  const raf = useRef()
  const from = useRef(0)

  useEffect(() => {
    const start = performance.now()
    const initial = from.current
    const delta = value - initial
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(initial + delta * eased))
      if (t < 1) raf.current = requestAnimationFrame(tick)
      else from.current = value
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, duration])

  return <span className={className}>{display}</span>
}
