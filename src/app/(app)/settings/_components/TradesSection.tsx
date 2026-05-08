'use client'

import { useActionState, useState } from 'react'
import { updateTrades, type TradesResult } from '../trades-actions'

const TRADE_OPTIONS = [
  { value: 'hvac', label: 'HVAC' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'deck_fence', label: 'Deck & Fence' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'general_contractor', label: 'General contractor' },
  { value: 'other', label: 'Other' },
] as const

type Props = {
  primary: string | null
  primaryOther: string | null
  additional: string[]
}

export function TradesSection({ primary, primaryOther, additional }: Props) {
  const [primaryValue, setPrimary] = useState<string>(primary ?? '')
  const [additionalSet, setAdditional] = useState<Set<string>>(new Set(additional))
  const [state, formAction, pending] = useActionState<TradesResult | null, FormData>(updateTrades, null)

  function toggleAdditional(value: string) {
    if (value === primaryValue || value === 'other') return
    const next = new Set(additionalSet)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setAdditional(next)
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="additional_trades" value={Array.from(additionalSet).join(',')} />

      <div>
        <label className="mb-1 block text-sm font-semibold text-zinc-900 dark:text-white">
          Primary trade
        </label>
        <select
          name="business_type"
          value={primaryValue}
          onChange={(e) => setPrimary(e.currentTarget.value)}
          className="w-full max-w-xs rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        >
          <option value="">— pick one —</option>
          {TRADE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {primaryValue === 'other' && (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Describe the business
            </label>
            <input
              type="text"
              name="business_type_other"
              defaultValue={primaryOther ?? ''}
              placeholder="e.g. pool service, garage door, appliance repair"
              className="w-full max-w-md rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-zinc-900 dark:text-white">
          Additional trades
        </label>
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          If you do more than one — e.g. HVAC and plumbing — pick the others
          here. The agent will know about both.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TRADE_OPTIONS.filter((o) => o.value !== 'other').map((o) => {
            const isPrimary = o.value === primaryValue
            const on = additionalSet.has(o.value)
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggleAdditional(o.value)}
                disabled={isPrimary}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  isPrimary
                    ? 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-500'
                    : on
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                      : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                {isPrimary ? `${o.label} (primary)` : on ? `✓ ${o.label}` : o.label}
              </button>
            )
          })}
        </div>
      </div>

      {state && state.ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          Saved and synced to Vapi.
        </div>
      )}
      {state && !state.ok && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {state.reason}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
