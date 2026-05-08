'use client'

import { useActionState, useState, useTransition } from 'react'
import { claimNumber } from '@/app/onboarding/actions'
import { importTwilioNumber, type ImportTwilioResult } from '../phone-twilio-actions'
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
  const [mode, setMode] = useState<'echon' | 'byo'>('echon')
  const [areaCode, setAreaCode] = useState(suggestion?.areaCode ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [byoResult, byoAction, byoPending] = useActionState<ImportTwilioResult | null, FormData>(
    importTwilioNumber,
    null,
  )
  const [byoPhoneDisplay, setByoPhoneDisplay] = useState('')

  function formatUsPhoneInput(raw: string): string {
    let digits = raw.replace(/\D/g, '')
    if (digits.startsWith('1') && digits.length > 10) digits = digits.slice(1)
    digits = digits.slice(0, 10)
    if (!digits) return ''
    if (digits.length <= 3) return `(${digits}`
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

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

  if (existing || (byoResult && byoResult.ok)) {
    const live = existing ?? {
      e164_number: (byoResult as { ok: true; e164: string }).e164,
      status: 'active',
      provisioned_at: new Date().toISOString(),
    }
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Your Echon number
            </p>
            <p className="mt-1 font-mono text-xl font-semibold text-zinc-900 dark:text-white">
              {formatPhone(live.e164_number)}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {live.status === 'active' ? 'Active' : live.status}
              {' · provisioned '}
              {new Date(live.provisioned_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          Need another number, or want to switch sources? Contact {SUPPORT_CONTACT}.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ---- MODE TOGGLE -------------------------------------------- */}
      <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setMode('echon')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === 'echon'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
              : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
          }`}
        >
          Get one from Echon
        </button>
        <button
          type="button"
          onClick={() => setMode('byo')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === 'byo'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
              : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
          }`}
        >
          Bring my own (Twilio)
        </button>
      </div>

      {/* ---- ECHON-MANAGED PATH ------------------------------------- */}
      {mode === 'echon' && (
        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-3 text-sm text-zinc-700 dark:text-zinc-300">
            Pick an area code — we&apos;ll claim a phone number for your AI
            receptionist instantly. No Twilio account needed.
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
              <span className="block mt-1 text-zinc-500 dark:text-zinc-400">
                Some area codes aren&apos;t available from Vapi. Try the &ldquo;Bring my own&rdquo; tab if you need a specific area code.
              </span>
            </p>
          )}
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            One number per workspace. Need more? Contact {SUPPORT_CONTACT}.
          </p>
        </div>
      )}

      {/* ---- BYO TWILIO PATH ---------------------------------------- */}
      {mode === 'byo' && (
        <form
          action={byoAction}
          className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div>
            <p className="mb-2 text-sm text-zinc-700 dark:text-zinc-300">
              Already have a phone number in your own Twilio account? Connect
              it here. Echon hands the number off to Vapi so calls route the
              same way as an Echon-managed number.
            </p>
            <details className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">How to find your Twilio credentials</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>Go to <span className="font-mono">console.twilio.com</span> and sign in.</li>
                <li>On the homepage, find <span className="font-mono">Account Info</span> — copy <span className="font-medium">Account SID</span> (starts with <span className="font-mono">AC…</span>).</li>
                <li>Click <span className="font-medium">View</span> next to <span className="font-medium">Auth Token</span> and copy it.</li>
                <li>Paste both below, plus the phone number you want to use (in your Twilio Phone Numbers section).</li>
              </ol>
              <p className="mt-2 text-zinc-500">Echon stores your Account SID for management; the auth token is sent to Vapi and not persisted on our side.</p>
            </details>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Phone number</label>
            <input
              type="tel"
              name="phone_number"
              value={byoPhoneDisplay}
              onChange={(e) => setByoPhoneDisplay(formatUsPhoneInput(e.currentTarget.value))}
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={14}
              placeholder="(512) 555-0143"
              className="w-full max-w-xs rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Must be a number you already own in Twilio.</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Twilio Account SID</label>
            <input
              type="text"
              name="account_sid"
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Twilio Auth Token</label>
            <input
              type="password"
              name="auth_token"
              placeholder="(32-character secret)"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Sent to Vapi to authenticate the number, not persisted on Echon&apos;s side.
            </p>
          </div>

          {byoResult && !byoResult.ok && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
              {byoResult.reason}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={byoPending}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {byoPending ? 'Connecting…' : 'Connect Twilio number'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
