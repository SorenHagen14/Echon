'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { StepCompleteOverlay } from '../_components/StepCompleteOverlay'
import type { StepResult } from '../actions'

type Props = {
  state: StepResult | null
  children: ReactNode
}

// Wraps a step form. When state.ok becomes true, fires the microcopy overlay
// for 1.2 s then navigates to the next step via router.push.
export function StepShell({ state, children }: Props) {
  const router = useRouter()
  const nextStepRef = useRef<number | null>(null)
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (state?.ok) {
      nextStepRef.current = state.nextStep
      setMessage(state.message)
      setVisible(true)
    }
  }, [state])

  function handleDismiss() {
    setVisible(false)
    if (nextStepRef.current != null) {
      router.push(`/onboarding/${nextStepRef.current}`)
    }
  }

  return (
    <>
      {children}
      <StepCompleteOverlay message={message} visible={visible} onDismiss={handleDismiss} />
    </>
  )
}
