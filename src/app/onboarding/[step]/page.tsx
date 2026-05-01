import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { advanceStep } from '../actions'
import { StepClientPieces } from '../_components/StepClientPieces'
import { Step1Welcome } from '../_steps/Step1Welcome'
import {
  CONFETTI_STEPS,
  SKIPPABLE_STEPS,
  TOTAL_STEPS,
  isValidStep,
  labelForStep,
} from '../_constants'

type Props = {
  params: Promise<{ step: string }>
}

export default async function StepPage({ params }: Props) {
  const { step } = await params
  const n = Number(step)
  if (!isValidStep(n)) notFound()

  const showConfetti = CONFETTI_STEPS.has(n)

  // Step 1 — Welcome (only step with real content as of Phase 2).
  // Steps 2-12 are placeholder cursor-advances until Phase 5 rebuilds them.
  if (n === 1) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', user.id)
      .single()

    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <Step1Welcome firstName={profile?.first_name ?? ''} />
        <StepClientPieces showConfetti={showConfetti} />
      </div>
    )
  }

  const label = labelForStep(n)
  const showSkip = SKIPPABLE_STEPS.has(n)
  const isFinale = n === TOTAL_STEPS

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-white">
        Step {n} of {TOTAL_STEPS} — {label}
      </h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        Placeholder — real content for this step lands in Phase 5 (HVAC-shaped onboarding).
      </p>

      <div className="flex items-center gap-3">
        <form action={advanceStep}>
          <input type="hidden" name="step" value={n} />
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isFinale ? 'Go to Dashboard' : 'Continue'}
          </button>
        </form>

        {showSkip && (
          <form action={advanceStep}>
            <input type="hidden" name="step" value={n} />
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Skip
            </button>
          </form>
        )}
      </div>

      <StepClientPieces showConfetti={showConfetti} />
    </div>
  )
}
