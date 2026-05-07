'use client'

import { useActionState } from 'react'
import { saveAndAdvance } from '../actions'
import { SubmitButton } from '../_components/SubmitButton'
import { StepShell } from './StepShell'
import { TEST_MODE } from '../_constants'

type Props = {
  defaults?: {
    business_name?: string
    business_phone?: string
    business_address?: string
    service_area?: string
  }
}

const inputClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white'

const labelClass = 'mb-1 block text-sm text-zinc-700 dark:text-zinc-300'

export function Step4BusinessInfo({ defaults }: Props) {
  const [state, action] = useActionState(saveAndAdvance, null)
  const fieldErrors = state && !state.ok ? state.errors : {}

  return (
    <StepShell state={state}>
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-white">
          Tell us about your business
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Your AI uses this to greet callers and verify service area.
        </p>
      </div>

      {state && !state.ok && state.errors._ && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {state.errors._[0]}
        </p>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="step" value={4} />

        <div>
          <label className={labelClass}>Business name *</label>
          <input
            type="text"
            name="business_name"
            required={!TEST_MODE}
            maxLength={100}
            defaultValue={defaults?.business_name ?? ''}
            placeholder="Acme HVAC"
            className={inputClass}
          />
          {fieldErrors.business_name && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.business_name[0]}</p>
          )}
        </div>

        <div>
          <label className={labelClass}>Business phone (optional)</label>
          <input
            type="tel"
            name="business_phone"
            maxLength={30}
            defaultValue={defaults?.business_phone ?? ''}
            placeholder="(512) 555-1234"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-zinc-500">Used if we ever forward overflow back to your line.</p>
        </div>

        <div>
          <label className={labelClass}>Business address (optional)</label>
          <input
            type="text"
            name="business_address"
            maxLength={300}
            defaultValue={defaults?.business_address ?? ''}
            placeholder="123 Main St, Austin, TX 78701"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Used for state-based call recording disclosure.
          </p>
        </div>

        <div>
          <label className={labelClass}>Service area (optional)</label>
          <input
            type="text"
            name="service_area"
            maxLength={300}
            defaultValue={defaults?.service_area ?? ''}
            placeholder="ZIPs (78701, 78702...) or radius (e.g. 25 miles)"
            className={inputClass}
          />
        </div>

        <div className="pt-2">
          <SubmitButton>Continue</SubmitButton>
        </div>
      </form>
    </StepShell>
  )
}
