'use client'

import { useActionState } from 'react'
import { saveAndAdvance } from '../actions'
import { SubmitButton } from '../_components/SubmitButton'
import { StepShell } from './StepShell'

const TOGGLES = [
  {
    name: 'quote_rule_replacement',
    label: 'Full system replacement',
    description: 'Replacements are big-ticket — route to a quote, not a same-day book.',
    defaultChecked: true,
  },
  {
    name: 'quote_rule_commercial',
    label: 'Commercial jobs',
    description: 'Commercial scoping varies; a real estimator should price it.',
    defaultChecked: true,
  },
  {
    name: 'quote_rule_insurance',
    label: 'Insurance claims',
    description: 'Insurance work needs paperwork and adjuster coordination.',
    defaultChecked: true,
  },
] as const

const inputCls =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white'

export function Step8QuoteRules() {
  const [state, action] = useActionState(saveAndAdvance, null)

  return (
    <StepShell state={state}>
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-white">
          Which jobs should be quoted, not booked?
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          For these, the agent collects details and a real person calls back with a quote.
        </p>
      </div>

      {state && !state.ok && state.errors._ && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {state.errors._[0]}
        </p>
      )}

      <form action={action}>
        <input type="hidden" name="step" value={8} />

        <div className="mb-6 grid gap-2">
          {TOGGLES.map((t) => (
            <label
              key={t.name}
              className="flex items-start gap-3 rounded-lg border border-zinc-200 px-4 py-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <input
                type="checkbox"
                name={t.name}
                defaultChecked={t.defaultChecked}
                className="mt-1 h-4 w-4"
              />
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-white">{t.label}</div>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{t.description}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="mb-6">
          <label className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
            Custom quote rules (optional)
          </label>
          <textarea
            name="quote_rule_custom"
            maxLength={500}
            rows={3}
            placeholder="e.g. Any job over $2,000 estimate, anything outside our service area..."
            className={inputCls}
          />
        </div>

        <SubmitButton>Continue</SubmitButton>
      </form>
    </StepShell>
  )
}
