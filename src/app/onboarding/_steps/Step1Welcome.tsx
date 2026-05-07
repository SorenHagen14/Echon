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
          Welcome aboard{firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">
          We&apos;ll get your AI receptionist live in about <strong>7 minutes</strong>.
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Here&apos;s what you&apos;ll need:
        </p>
        <ul className="mt-2 list-disc pl-5 text-sm text-zinc-500 dark:text-zinc-400">
          <li>Your business hours</li>
          <li>The services you offer</li>
          <li>A Google account (optional, for calendar booking)</li>
        </ul>
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
