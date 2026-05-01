'use client'

import { Confetti } from './Confetti'

type Props = {
  showConfetti: boolean
}

// Client-side surface for a step page — confetti only.
// The microcopy overlay moved into StepShell (wired to each step form in 2b.2).
// Placeholder steps 7–10 will add their own overlay wiring in 2b.3.
export function StepClientPieces({ showConfetti }: Props) {
  return <>{showConfetti && <Confetti />}</>
}
