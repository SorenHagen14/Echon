'use client'

import { useState, useTransition } from 'react'
import { claimNumber } from '@/app/onboarding/actions'
import type { AreaCodeSuggestion } from '@/lib/voice/area-code'
import { SUPPORT_CONTACT } from '../_constants'

function formatPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return e164
}

export type PhoneNumberRow = {
  e164_number: string
  status: string
  provisioned_at: string
}

// Settings → Connections → Echon phone number. Reuses the onboarding Step 11
// `claimNumber` server action so the number provisioning path is a single
// implementation. The DB row in `phone_numbers` is the single source of
// truth — onboarding writes it, this section reads it, both stay synced.
//
// One number per workspace. Need more? Contact support.
export function PhoneNumberSection({
  existing,
  suggestion,
}: {
  existing: PhoneNumberRow | null
  suggestion: AreaCodeSuggestion | null
}) {
  const [areaCode, setAreaCode] = useState(suggestion?.areaCode ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onClaim() {
    setError(null)
    startTransition(async () => {
      const res = await claimNumber(areaCode)
      if (!res.ok) {
        setError(res.reason)
        return
      }
      // Server action revalidates the path; full reload is fine here too.
      window.location.reload()
    })
  }

  if (existing) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Your Echon number
            </p>
            <p className="mt-1 font-mono text-xl font-semibold text-zinc-900 dark:text-white">
              {formatPhone(existing.e164_number)}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {existing.status === 'active' ? 'Active' : existing.status}
              {' · provisioned '}
              {new Date(existing.provisioned_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          Need another number? Contact {SUPPORT_CONTACT}.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-3 text-sm text-zinc-700 dark:text-zinc-300">
        Pick an area code — we&apos;ll claim a phone number for your AI
        receptionist instantly.
      </p>
      {suggestion && (
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          {suggestion.source === 'phone'
            ? 'Prefilled from your business phone.'
            : `Prefilled based on your business address (${suggestion.state}).`}
        </p>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{3}"
          maxLength={3}
          value={areaCode}
          onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
          placeholder="555"
          className="w-28 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white"
        />
        <button
          type="button"
          onClick={onClaim}
          disabled={pending || areaCode.length !== 3}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? 'Getting your number…' : 'Get my number'}
        </button>
      </div>
      {error && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        One number per workspace. Need more? Contact {SUPPORT_CONTACT}.
      </p>
    </div>
  )
}
