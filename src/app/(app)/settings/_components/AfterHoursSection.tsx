'use client'

import { useActionState, useState } from 'react'
import { updateAfterHours, type AfterHoursResult } from '../after-hours-actions'

type Mode = 'messages_only' | 'escalate' | 'live_transfer'

type OncallEntry = { phone: string; label: string }

type Props = {
  initialMode: Mode
  initialOncall: OncallEntry[]
}

const MODES: { value: Mode; label: string; description: string }[] = [
  {
    value: 'messages_only',
    label: 'Take a message',
    description:
      'After-hours callers leave their name, number, and reason. The team sees them on the dashboard the next morning.',
  },
  {
    value: 'escalate',
    label: 'Escalate emergencies',
    description:
      'Routine callers get a message taken; emergencies (gas, flood, no heat in cold) trigger a callback alert to your on-call number.',
  },
  {
    value: 'live_transfer',
    label: 'Always live-transfer',
    description:
      'Every after-hours call is transferred to your on-call number. Best when someone is always on rotation.',
  },
]

export function AfterHoursSection({ initialMode, initialOncall }: Props) {
  const [state, formAction, pending] = useActionState<AfterHoursResult | null, FormData>(
    updateAfterHours,
    null,
  )

  const [mode, setMode] = useState<Mode>(initialMode)
  const [oncall, setOncall] = useState<OncallEntry[]>(
    initialOncall.length > 0 ? initialOncall : [{ phone: '', label: '' }],
  )

  const needsNumber = mode !== 'messages_only'

  function setEntry(i: number, field: 'phone' | 'label', value: string) {
    setOncall((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  }
  function addEntry() {
    setOncall((prev) => (prev.length >= 10 ? prev : [...prev, { phone: '', label: '' }]))
  }
  function removeEntry(i: number) {
    setOncall((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)))
  }

  return (
    <form action={formAction} className="space-y-8">
      <input
        type="hidden"
        name="oncall_json"
        value={JSON.stringify(oncall.filter((r) => r.phone.trim().length > 0))}
      />

      <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
          What happens outside business hours?
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Set hours in{' '}
          <a href="/settings/hours" className="text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400">
            Settings → Hours
          </a>
          .
        </p>
        <div className="mt-2 grid gap-2">
          {MODES.map((m) => (
            <label
              key={m.value}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 px-4 py-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <input
                type="radio"
                name="mode"
                value={m.value}
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-white">{m.label}</div>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{m.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">On-call numbers</h3>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {needsNumber ? 'Required for the mode above' : 'Optional with "Take a message"'}
          </span>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          E.164 format, e.g. <code className="font-mono">+15125551234</code>. First number is tried
          first; subsequent numbers are fallbacks.
        </p>

        <div className="space-y-2">
          {oncall.map((entry, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="tel"
                inputMode="tel"
                placeholder="+15125551234"
                value={entry.phone}
                onChange={(e) => setEntry(i, 'phone', e.target.value)}
                className="w-44 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <input
                type="text"
                placeholder="Label (e.g. Owner cell)"
                value={entry.label}
                onChange={(e) => setEntry(i, 'label', e.target.value)}
                maxLength={40}
                className="flex-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={() => removeEntry(i)}
                disabled={oncall.length === 1}
                className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-30 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Remove
              </button>
            </div>
          ))}
          {oncall.length < 10 && (
            <button
              type="button"
              onClick={addEntry}
              className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
            >
              + Add another number
            </button>
          )}
        </div>
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
