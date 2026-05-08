'use client'

import { useActionState, useState } from 'react'
import {
  DEFAULT_NON_TRIGGERS,
  DEFAULT_TRIGGERS,
  updateEscalationRules,
  type EscalationResult,
} from '../escalation-actions'

type Props = {
  initialTriggers: string[]
  initialNonTriggers: string[]
}

// Pill row for "what to escalate on / what NOT to escalate on" with
// pre-filled defaults that owners can toggle off, plus a free-text area
// for custom additions. Selected items get baked into the system prompt
// on save.
export function EscalationSection({ initialTriggers, initialNonTriggers }: Props) {
  const [state, formAction, pending] = useActionState<EscalationResult | null, FormData>(
    updateEscalationRules,
    null,
  )

  // Anything not in the defaults list is treated as a custom entry — show
  // those in the textarea so the owner can edit them.
  const initialCustomTriggers = initialTriggers.filter((t) => !DEFAULT_TRIGGERS.includes(t as typeof DEFAULT_TRIGGERS[number]))
  const initialCustomNon = initialNonTriggers.filter((t) => !DEFAULT_NON_TRIGGERS.includes(t as typeof DEFAULT_NON_TRIGGERS[number]))

  const [activeTriggers, setActiveTriggers] = useState<Set<string>>(
    new Set(initialTriggers.filter((t) => DEFAULT_TRIGGERS.includes(t as typeof DEFAULT_TRIGGERS[number]))),
  )
  const [activeNon, setActiveNon] = useState<Set<string>>(
    new Set(initialNonTriggers.filter((t) => DEFAULT_NON_TRIGGERS.includes(t as typeof DEFAULT_NON_TRIGGERS[number]))),
  )

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, value: string) {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setter(next)
  }

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="triggers" value={JSON.stringify(Array.from(activeTriggers))} />
      <input type="hidden" name="non_triggers" value={JSON.stringify(Array.from(activeNon))} />

      <Card>
        <CardTitle>Escalate immediately when…</CardTitle>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Click a pill to turn it on (filled) or off (outlined). Anything left
          on goes into the system prompt as a hard escalation rule.
        </p>
        <Pills
          options={[...DEFAULT_TRIGGERS]}
          active={activeTriggers}
          onToggle={(v) => toggle(activeTriggers, setActiveTriggers, v)}
        />
        <CustomTextarea
          name="triggers_custom"
          defaultValue={initialCustomTriggers.join('\n')}
          placeholder={'One trigger per line. Example:\nCaller mentions a refund request'}
          label="Add your own triggers"
        />
      </Card>

      <Card>
        <CardTitle>Don&apos;t escalate just because…</CardTitle>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          These are normal call topics. Pills you leave on tell the agent
          &ldquo;handle these in the usual flow — don&apos;t route them to a human.&rdquo;
        </p>
        <Pills
          options={[...DEFAULT_NON_TRIGGERS]}
          active={activeNon}
          onToggle={(v) => toggle(activeNon, setActiveNon, v)}
        />
        <CustomTextarea
          name="non_triggers_custom"
          defaultValue={initialCustomNon.join('\n')}
          placeholder={'One topic per line.'}
          label="Add your own &quot;don&apos;t escalate&quot; topics"
        />
      </Card>

      {state && state.ok && (
        <Banner kind="ok">Saved and synced to Vapi.</Banner>
      )}
      {state && !state.ok && (
        <Banner kind="error">
          <p className="font-semibold">{state.savedToDb ? 'Partial save' : 'Save failed'}</p>
          <p className="mt-0.5 text-xs">{state.reason}</p>
        </Banner>
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

// ---- UI primitives ----------------------------------------------------

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      {children}
    </div>
  )
}
function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{children}</h3>
}

function Pills({ options, active, onToggle }: {
  options: string[]
  active: Set<string>
  onToggle: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const on = active.has(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              on
                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            {on ? '✓ ' : ''}{opt}
          </button>
        )
      })}
    </div>
  )
}

function CustomTextarea({ name, defaultValue, placeholder, label }: {
  name: string
  defaultValue: string
  placeholder: string
  label: string
}) {
  return (
    <div className="mt-3">
      <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={3}
        placeholder={placeholder}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white"
      />
    </div>
  )
}

function Banner({ kind, children }: { kind: 'ok' | 'error'; children: React.ReactNode }) {
  const cls = kind === 'ok'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
    : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
  return <div className={`rounded-md border px-3 py-2 text-sm ${cls}`}>{children}</div>
}
