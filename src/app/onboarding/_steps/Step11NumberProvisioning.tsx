'use client'

import { useState, useTransition } from 'react'
import { advanceStep, claimNumber } from '../actions'

const PRIMARY =
  'rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200'

const inputCls =
  'w-32 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white'

function formatPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return e164
}

export function Step11NumberProvisioning() {
  const [areaCode, setAreaCode] = useState('')
  const [claimed, setClaimed] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleClaim() {
    setError(null)
    startTransition(async () => {
      const res = await claimNumber(areaCode)
      if (!res.ok) {
        setError(res.reason)
        return
      }
      setClaimed(res.e164)
    })
  }

  if (claimed) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-white">
          Your new Echon number is ready
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          This is the number your AI will answer on. Don&apos;t worry — your
          customers will keep calling the same business number they always have.
        </p>

        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40">
          <div className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Your Echon number
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold text-emerald-900 dark:text-emerald-100">
            {formatPhone(claimed)}
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
            What happens next
          </h2>
          <ol className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
            <li>
              <span className="font-medium">1.</span> We&apos;ll schedule a quick
              5-minute call to walk you through one setting on your existing
              business line — call forwarding.
            </li>
            <li>
              <span className="font-medium">2.</span> Once that&apos;s on, every
              call to your current number rings through to your new Echon number,
              and your AI answers.
            </li>
            <li>
              <span className="font-medium">3.</span> Your customers don&apos;t
              notice anything different. They call the number they&apos;ve always
              called.
            </li>
          </ol>
          <p className="mt-4 text-xs text-zinc-500">
            We&apos;ll send you a link to book the setup call after you finish
            onboarding. You can also set up forwarding yourself any time from
            Settings.
          </p>
        </div>

        <form action={advanceStep}>
          <input type="hidden" name="step" value={11} />
          <button type="submit" className={PRIMARY}>
            Continue
          </button>
        </form>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-white">
        Get a phone number for your AI
      </h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Your AI receptionist needs its own phone number to answer calls on.
        Pick an area code you&apos;d like — we&apos;ll grab one for you instantly.
      </p>

      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
          How this works
        </h2>
        <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <li className="flex gap-2">
            <span className="text-zinc-400">•</span>
            <span>
              You&apos;ll get a brand-new phone number from Echon. This is what
              your AI answers on.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-zinc-400">•</span>
            <span>
              <span className="font-medium">You don&apos;t give out the new number.</span>{' '}
              Customers keep calling your existing business line.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-zinc-400">•</span>
            <span>
              We&apos;ll help you turn on call forwarding so calls to your old
              number ring through to the new one — your AI picks up.
            </span>
          </li>
        </ul>
      </div>

      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-white">
          Area code
        </label>
        <p className="mb-3 text-xs text-zinc-500">
          A 3-digit area code (like the first 3 digits of your business phone).
          We&apos;ll pick an available number for you.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{3}"
            maxLength={3}
            value={areaCode}
            onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
            placeholder="555"
            className={inputCls}
          />
          <button
            type="button"
            onClick={handleClaim}
            disabled={pending || areaCode.length !== 3}
            className={PRIMARY}
          >
            {pending ? 'Getting your number…' : 'Get my number'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}
