'use client'

import { useActionState, useState } from 'react'
import { updateOnCallNumbers, type OnCallResult } from '../oncall-actions'

// Drops non-digits, ignores a leading 1 (we already prefix +1 server-side),
// caps at 10 digits, and emits "(XXX) XXX-XXXX" for any length.
function formatUsPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('1') && digits.length > 10) digits = digits.slice(1)
  digits = digits.slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function initialFromE164(e164: string | null): string {
  if (!e164) return ''
  return formatUsPhone(e164)
}

type Props = {
  initialPhone: string | null
  initialLabel: string | null
}

// Settings → Receptionist → On-call. Holds the phone number(s) that the
// AI hands off to when the `transfer_call` tool fires (live PSTN
// transfer) or when escalation needs a human callback.
//
// MVP: one primary number. Rotation lives in the schema (oncall_numbers
// is jsonb[]) but the UI keeps it simple until pilot feedback asks for it.
export function OnCallSection({ initialPhone, initialLabel }: Props) {
  const [state, formAction, pending] = useActionState<OnCallResult | null, FormData>(updateOnCallNumbers, null)
  const [phoneDisplay, setPhoneDisplay] = useState(initialFromE164(initialPhone))

  return (
    <form action={formAction} className="space-y-5">
      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          The phone number the AI dials when it transfers a caller to a
          human. Used by the <code>transfer_call</code> tool for live
          handoffs and shown to your team for escalation callbacks.
        </p>

        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Primary on-call number
            </label>
            <input
              type="tel"
              name="primary_phone"
              value={phoneDisplay}
              onChange={(e) => setPhoneDisplay(formatUsPhone(e.currentTarget.value))}
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={14}            // (XXX) XXX-XXXX = 14 chars
              placeholder="(512) 555-0143"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              US 10-digit format. Leave blank to disable live transfer
              (escalations will fall back to message-taking).
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Label
            </label>
            <input
              type="text"
              name="primary_label"
              defaultValue={initialLabel ?? 'Primary on-call'}
              maxLength={40}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Internal name (e.g. &quot;Mike&apos;s cell&quot;).
            </p>
          </div>
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
