'use client'

import { useActionState } from 'react'
import { updateAgentRole, type RoleResult } from '../role-actions'

type Capability = 'booking' | 'messaging' | 'faq'

const CAPABILITIES: {
  value: Capability
  label: string
  description: string
}[] = [
  {
    value: 'booking',
    label: 'Book appointments',
    description: 'Agent offers available time slots and schedules service calls directly. Quote requests are also routed and captured.',
  },
  {
    value: 'messaging',
    label: 'Take messages & create cases',
    description: 'Agent collects the caller\'s name, number, and reason for calling, then tells them someone will follow up. Use this when you don\'t want the agent booking — just gathering info.',
  },
  {
    value: 'faq',
    label: 'Answer common questions',
    description: 'Agent handles questions about services, pricing, availability, and hours inline without escalating. Turn off to have all questions routed to a human.',
  },
]

type Props = {
  initial: Capability[]
}

export function RoleSection({ initial }: Props) {
  const [state, formAction, pending] = useActionState<RoleResult | null, FormData>(
    updateAgentRole,
    null,
  )

  return (
    <form action={formAction} className="space-y-8">
      <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
          What is the receptionist in charge of?
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Select everything the AI should handle. Unselected capabilities are escalated to a human.
          At least one must be selected.
        </p>

        <div className="mt-2 grid gap-2">
          {CAPABILITIES.map((cap) => {
            const checked = initial.includes(cap.value)
            return (
              <label
                key={cap.value}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 px-4 py-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
              >
                <input
                  type="hidden"
                  name={`cap_${cap.value}_present`}
                  value="1"
                />
                <input
                  type="checkbox"
                  name={`cap_${cap.value}`}
                  defaultChecked={checked}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-white">
                    {cap.label}
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {cap.description}
                  </p>
                </div>
              </label>
            )
          })}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Escalate immediately when…
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          These are hard cut-offs — the agent stops the normal flow and routes
          the caller to a human regardless of the capabilities above. Configure
          the full list in{' '}
          <a
            href="/settings/escalation"
            className="text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400"
          >
            Settings → Escalation
          </a>
          .
        </p>
        <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
          <li className="flex gap-2">
            <span className="text-zinc-400">•</span>
            Caller explicitly asks to speak to a person or the owner
          </li>
          <li className="flex gap-2">
            <span className="text-zinc-400">•</span>
            Caller is upset, cursing, or threatening
          </li>
          <li className="flex gap-2">
            <span className="text-zinc-400">•</span>
            Caller mentions an emergency keyword (gas, flooding, smoke, etc.)
          </li>
          <li className="flex gap-2">
            <span className="text-zinc-400">•</span>
            Caller has an issue outside your services or service area
          </li>
        </ul>
      </div>

      {state && state.ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          Saved and synced to Vapi.
        </div>
      )}
      {state && !state.ok && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <p className="font-semibold">{state.savedToDb ? 'Partial save' : 'Save failed'}</p>
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
