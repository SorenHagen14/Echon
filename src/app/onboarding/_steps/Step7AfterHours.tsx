'use client'

import { useActionState, useState } from 'react'
import { saveAndAdvance } from '../actions'
import { SubmitButton } from '../_components/SubmitButton'
import { StepShell } from './StepShell'
import { TEST_MODE } from '../_constants'

type Mode = 'messages_only' | 'escalate'

const OPTIONS: { value: Mode; label: string; recommended?: boolean; description: string }[] = [
  {
    value: 'messages_only',
    label: 'Take messages only',
    description: 'Agent collects info, books for next morning, no after-hours interruptions.',
  },
  {
    value: 'escalate',
    label: 'Escalate emergencies',
    recommended: true,
    description: 'If the AI hears an emergency (gas, water leak, no heat in a freeze, etc.), it texts your on-call number with the caller’s name, number, and the issue.',
  },
]

const inputCls =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white'

export function Step7AfterHours() {
  const [state, action] = useActionState(saveAndAdvance, null)
  const [mode, setMode] = useState<Mode>('escalate')
  const fieldErrors = state && !state.ok ? state.errors : {}

  const requiresOnCall = mode === 'escalate'

  return (
    <StepShell state={state}>
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-white">
          What happens after hours?
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          You can change this anytime in Settings.
        </p>
      </div>

      {state && !state.ok && state.errors._ && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {state.errors._[0]}
        </p>
      )}

      <form action={action}>
        <input type="hidden" name="step" value={7} />

        <div className="mb-6 grid gap-2">
          {OPTIONS.map((opt) => {
            const checked = mode === opt.value
            return (
              <label
                key={opt.value}
                className={`cursor-pointer rounded-lg border px-4 py-3 transition-colors ${
                  checked
                    ? 'border-zinc-900 bg-zinc-50 dark:border-white dark:bg-zinc-800'
                    : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="after_hours_mode"
                    value={opt.value}
                    checked={checked}
                    onChange={(e) => setMode(e.target.value as Mode)}
                    className="mt-1 h-4 w-4"
                  />
                  <div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-white">
                      {opt.label}
                      {opt.recommended && (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{opt.description}</p>
                  </div>
                </div>
              </label>
            )
          })}
        </div>

        {requiresOnCall && (
          <div className="mb-6">
            <label className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
              On-call phone number *
            </label>
            <input
              type="tel"
              name="oncall_phone"
              maxLength={30}
              required={!TEST_MODE}
              placeholder="(512) 555-0911"
              className={inputCls}
            />
            {fieldErrors.oncall_phone && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.oncall_phone[0]}
              </p>
            )}
          </div>
        )}

        <SubmitButton>Continue</SubmitButton>
      </form>
    </StepShell>
  )
}
