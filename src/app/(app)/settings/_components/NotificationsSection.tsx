'use client'

import { useActionState } from 'react'
import { updateNotificationPrefs, type NotificationsResult } from '../notifications-actions'

export type NotificationPrefs = {
  emergency_escalation: boolean
  quote_request:        boolean
  flagged_for_review:   boolean
  ai_failed:            boolean
  contact_email:        string | null
}

type Props = {
  initial: NotificationPrefs
  ownerEmail: string | null
}

const TOGGLES: { name: keyof NotificationPrefs; label: string; description: string }[] = [
  {
    name: 'emergency_escalation',
    label: 'Emergency & after-hours',
    description:
      'Mid-call escalations and after-hours messages. Includes calls the AI hands off when a caller asks for a person.',
  },
  {
    name: 'quote_request',
    label: 'Quote requests',
    description:
      'A caller asked for pricing or an estimate but did not book.',
  },
  {
    name: 'flagged_for_review',
    label: 'Flagged calls',
    description:
      'Calls where the AI thinks something looks off — hallucinated info, upset caller, ambiguous outcome.',
  },
  {
    name: 'ai_failed',
    label: 'AI failures',
    description:
      'Calls Echon could not finish processing. Rare, but worth a look when they happen.',
  },
]

export function NotificationsSection({ initial, ownerEmail }: Props) {
  const [state, formAction, pending] = useActionState<NotificationsResult | null, FormData>(
    updateNotificationPrefs,
    null,
  )

  return (
    <form action={formAction} className="space-y-8">
      <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">In-app alerts</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          What appears in the &ldquo;Needs attention&rdquo; list on your dashboard.
          Toggling off hides the row from the list — the call itself is still
          on the call log.
        </p>

        <div className="mt-2 grid gap-2">
          {TOGGLES.map((t) => (
            <label
              key={t.name}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 px-4 py-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <input
                type="checkbox"
                name={t.name}
                defaultChecked={initial[t.name] !== false}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-white">{t.label}</div>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{t.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Email</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Where to send the alerts above when email delivery is enabled. Leave
          blank to use your account email
          {ownerEmail ? <> (<span className="font-mono">{ownerEmail}</span>)</> : null}.
        </p>
        <input
          type="email"
          name="contact_email"
          defaultValue={initial.contact_email ?? ''}
          placeholder={ownerEmail ?? 'you@example.com'}
          className="w-full max-w-md rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          Email delivery is queued — alerts are recorded now and will start
          sending once Echon&rsquo;s transactional email is wired up.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-dashed border-zinc-300 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">SMS &amp; push</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Coming soon. SMS alerts are particularly useful for emergency
          escalations during after-hours rotation.
        </p>
      </div>

      {state && state.ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          Saved.
        </div>
      )}
      {state && !state.ok && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <p className="font-semibold">Save failed</p>
          <p className="mt-0.5 text-xs">{state.reason}</p>
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
