'use client'

import { useActionState, useState } from 'react'
import { saveAndAdvance } from '../actions'
import { SubmitButton } from '../_components/SubmitButton'
import { StepShell } from './StepShell'
import type { BusinessType, ServiceOption } from '../_constants'

type Props = {
  businessType: BusinessType | null
  catalog: readonly ServiceOption[]
  defaults?: { selected?: string[]; freeText?: string }
}

export function Step5Services({ businessType, catalog, defaults }: Props) {
  const [state, action] = useActionState(saveAndAdvance, null)
  const [selected, setSelected] = useState<Set<string>>(
    new Set(defaults?.selected ?? []),
  )
  const [freeText, setFreeText] = useState(defaults?.freeText ?? '')

  const fieldErrors = state && !state.ok ? state.errors : {}
  const isOther = businessType === 'other' || catalog.length === 0

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <StepShell state={state}>
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-white">
          Which services do you offer?
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {isOther
            ? 'List your services, one per line. The AI will only book or quote what you offer.'
            : 'Pick all that apply. The AI will only book or quote what you offer.'}
        </p>
      </div>

      {state && !state.ok && state.errors._ && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {state.errors._[0]}
        </p>
      )}

      <form action={action}>
        <input type="hidden" name="step" value={5} />

        {isOther ? (
          <>
            <textarea
              name="services_freetext"
              rows={8}
              maxLength={2000}
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder={'e.g.\nWindow cleaning\nGutter cleaning\nPressure washing'}
              className="mb-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white"
            />
            {fieldErrors.services_freetext && (
              <p className="mb-4 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.services_freetext[0]}
              </p>
            )}
          </>
        ) : (
          <>
            <input
              type="hidden"
              name="services_keys"
              value={Array.from(selected).join(',')}
            />
            <div className="mb-6 grid gap-2 sm:grid-cols-2">
              {catalog.map((svc) => {
                const isOn = selected.has(svc.key)
                return (
                  <button
                    key={svc.key}
                    type="button"
                    onClick={() => toggle(svc.key)}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                      isOn
                        ? 'border-zinc-900 bg-zinc-50 dark:border-white dark:bg-zinc-800'
                        : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded border ${
                        isOn
                          ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                          : 'border-zinc-300 dark:border-zinc-700'
                      }`}
                    >
                      {isOn && <span className="text-xs">✓</span>}
                    </span>
                    <span className="text-zinc-900 dark:text-white">{svc.label}</span>
                  </button>
                )
              })}
            </div>

            {fieldErrors.services_keys && (
              <p className="mb-4 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.services_keys[0]}
              </p>
            )}
          </>
        )}

        <SubmitButton>Continue</SubmitButton>
      </form>
    </StepShell>
  )
}
