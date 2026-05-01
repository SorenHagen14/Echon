'use client'

import { useActionState } from 'react'
import { saveAndAdvance } from '../actions'
import { SubmitButton } from '../_components/SubmitButton'
import { StepShell } from './StepShell'

type Props = { firstName: string }

export function Step1Welcome({ firstName }: Props) {
  const [state, action] = useActionState(saveAndAdvance, null)

  return (
    <StepShell state={state}>
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-white">
          Welcome{firstName ? `, ${firstName}` : ''}!
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Your account is created. Let&apos;s set up your AI so it sounds exactly like you — it only takes a few minutes.
        </p>
      </div>

      {state && !state.ok && state.errors._ && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {state.errors._[0]}
        </p>
      )}

      <form action={action}>
        <input type="hidden" name="step" value={1} />
        <SubmitButton>Continue</SubmitButton>
      </form>
    </StepShell>
  )
}
