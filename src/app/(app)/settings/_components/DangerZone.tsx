'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { scheduleWorkspaceDeletion } from '../account-actions'

const CONFIRM_PHRASE = 'DELETE my workspace'

type Step = 'idle' | 'warn' | 'transfer' | 'final'

// Bottom-of-page card on Settings → Profile. Three confirm steps before we
// schedule the soft-delete. Owner has 14 days to cancel from the recovery
// banner before pg_cron purges the workspace permanently.
export function DangerZone() {
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await scheduleWorkspaceDeletion(form)
      if (!result.ok) setError(result.error)
      // On success the action signs out + redirects to /login.
    })
  }

  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-5 dark:border-red-900/50 dark:bg-red-950/20">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">
        Danger zone
      </h3>
      <p className="mb-4 text-sm text-zinc-700 dark:text-zinc-300">
        Delete your workspace. You&apos;ll have 14 days to change your mind. After
        that, your business profile, customers, cases, schedule, and settings are
        permanently removed and your phone number is released.
      </p>

      {step === 'idle' && (
        <button
          type="button"
          onClick={() => setStep('warn')}
          className="rounded-md border border-red-300 bg-white px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          Delete workspace…
        </button>
      )}

      {step === 'warn' && (
        <div className="space-y-4">
          <div className="rounded-md border border-red-300 bg-white p-4 dark:border-red-900 dark:bg-zinc-900">
            <p className="mb-2 text-sm font-medium text-red-800 dark:text-red-300">This is permanent.</p>
            <ul className="ml-4 list-disc space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
              <li>Every customer, case, call, and appointment will be deleted.</li>
              <li>Your AI receptionist will stop answering calls immediately.</li>
              <li>Your Echon phone number will be released back to the carrier.</li>
              <li>Anyone you&apos;ve invited to this workspace will lose access.</li>
              <li>You have 14 days to cancel. After that, recovery is impossible.</li>
            </ul>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep('transfer')}
              className="rounded-md border border-red-300 bg-white px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              I understand, continue
            </button>
            <button
              type="button"
              onClick={() => setStep('idle')}
              className="rounded-md px-4 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === 'transfer' && (
        <div className="space-y-4">
          <div className="rounded-md border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="mb-2 text-sm font-medium text-zinc-900 dark:text-white">
              Transfer ownership instead?
            </p>
            <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
              If a manager is taking over for you, transfer the workspace to them
              and your account becomes a regular member. The business keeps running.
            </p>
            <button
              type="button"
              disabled
              title="Available once teammate roles ship"
              className="cursor-not-allowed rounded-md border border-zinc-300 bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
            >
              Transfer ownership (unavailable)
            </button>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Requires inviting a teammate first. <Link href="/settings/team" className="underline hover:text-zinc-900 dark:hover:text-white">Invite in Team settings</Link>.
              Coming soon.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep('final')}
              className="rounded-md border border-red-300 bg-white px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              Continue with deletion
            </button>
            <button
              type="button"
              onClick={() => setStep('idle')}
              className="rounded-md px-4 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Never mind
            </button>
          </div>
        </div>
      )}

      {step === 'final' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border border-red-300 bg-white p-4 dark:border-red-900 dark:bg-zinc-900">
            <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-white">
              Type <code className="rounded bg-zinc-100 px-1 py-0.5 text-red-700 dark:bg-zinc-800 dark:text-red-400">{CONFIRM_PHRASE}</code> to confirm
            </label>
            <input
              type="text"
              name="confirm_phrase"
              required
              autoComplete="off"
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />

            <label className="mt-4 mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Why are you leaving? <span className="font-normal text-zinc-500">(optional, helps us improve)</span>
            </label>
            <textarea
              name="reason"
              rows={3}
              maxLength={500}
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              placeholder="What didn't work for you?"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? 'Scheduling…' : 'Delete my workspace'}
            </button>
            <button
              type="button"
              onClick={() => setStep('idle')}
              disabled={isPending}
              className="rounded-md px-4 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Back out
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
