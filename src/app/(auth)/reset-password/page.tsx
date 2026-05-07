'use client'

import { useActionState } from 'react'
import { setNewPassword, type ResetState } from './actions'

const inputClass =
  'w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100'

export default function ResetPasswordPage() {
  const [state, formAction, isPending] = useActionState<ResetState, FormData>(setNewPassword, null)

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm">
      <h2 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-white">Set a new password</h2>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">Pick something at least 8 characters. You&apos;ll stay signed in after.</p>

      {state?.type === 'error' && (
        <p className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">New password</label>
          <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} placeholder="••••••••" />
        </div>
        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Confirm password</label>
          <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputClass} placeholder="••••••••" />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-zinc-900 dark:bg-white px-4 py-2.5 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Saving…' : 'Set password'}
        </button>
      </form>
    </div>
  )
}
