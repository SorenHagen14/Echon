'use client'

import { useActionState, useState } from 'react'
import { saveAndAdvance } from '../actions'
import { SubmitButton } from '../_components/SubmitButton'
import { StepShell } from './StepShell'
import { REFERRAL_SOURCE_OPTIONS } from '../_constants'

export function Step2Referral() {
  const [state, action] = useActionState(saveAndAdvance, null)
  const [selected, setSelected] = useState<string>('')

  const fieldErrors = state && !state.ok ? state.errors : {}

  return (
    <StepShell state={state}>
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-white">
          Where did you hear about us?
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Pick the closest match — helps us know what&apos;s working.
        </p>
      </div>

      {state && !state.ok && state.errors._ && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {state.errors._[0]}
        </p>
      )}

      <form action={action}>
        <input type="hidden" name="step" value={2} />

        <div className="mb-6 grid gap-2">
          {REFERRAL_SOURCE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                selected === opt.value
                  ? 'border-zinc-900 bg-zinc-50 dark:border-white dark:bg-zinc-800'
                  : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50'
              }`}
            >
              <input
                type="radio"
                name="referral_source"
                value={opt.value}
                checked={selected === opt.value}
                onChange={(e) => setSelected(e.target.value)}
                className="h-4 w-4"
              />
              <span className="text-sm text-zinc-900 dark:text-white">{opt.label}</span>
            </label>
          ))}
        </div>

        {selected === 'other' && (
          <div className="mb-6">
            <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-300">
              Tell us where
            </label>
            <input
              type="text"
              name="referral_source_other"
              maxLength={200}
              placeholder="e.g. Reddit, podcast, etc."
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white"
            />
            {fieldErrors.referral_source_other && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.referral_source_other[0]}
              </p>
            )}
          </div>
        )}

        <SubmitButton>Continue</SubmitButton>
      </form>
    </StepShell>
  )
}
