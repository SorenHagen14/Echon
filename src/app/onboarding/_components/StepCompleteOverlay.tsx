'use client'

import { useEffect, useState } from 'react'

type Props = {
  message: string
  visible: boolean
  onDismiss: () => void
}

const AUTO_DISMISS_MS = 1200

export function StepCompleteOverlay({ message, visible, onDismiss }: Props) {
  // Mount-time fade uses a two-state flag so the transition plays on enter.
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (!visible) {
      setMounted(false)
      return
    }

    const raf = requestAnimationFrame(() => setMounted(true))
    const timer = setTimeout(() => {
      setMounted(false)
      onDismiss()
    }, AUTO_DISMISS_MS)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [visible, onDismiss])

  if (!visible) return null

  return (
    <div
      aria-live="polite"
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200 ${
        mounted ? 'opacity-100' : 'opacity-0'
      } pointer-events-none bg-white/70 dark:bg-zinc-950/70 backdrop-blur-sm`}
    >
      <p className="text-2xl font-medium text-zinc-900 dark:text-white">{message}</p>
    </div>
  )
}
