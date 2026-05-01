'use client'

import { useEffect, useState } from 'react'
import confetti from 'canvas-confetti'

// Fires one burst on mount, unmounts itself after the animation settles.
// Milestone logic lives in the parent — this component is intentionally dumb.

const BURST_DURATION_MS = 2000

export function Confetti() {
  const [alive, setAlive] = useState(true)

  useEffect(() => {
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
    })

    const timer = setTimeout(() => setAlive(false), BURST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [])

  if (!alive) return null

  // Nothing to render — canvas-confetti manages its own canvas.
  return null
}
