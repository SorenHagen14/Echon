'use client'

import { useActionState, useMemo, useState } from 'react'
import { saveAndAdvance } from '../actions'
import { SubmitButton } from '../_components/SubmitButton'
import { StepShell } from './StepShell'

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
type DayHours = { open: string; close: string; closed: boolean }
export type WeekHours = Record<DayKey, DayHours>

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

const DEFAULT_OPEN = '08:00'
const DEFAULT_CLOSE = '17:00'

function defaultHours(): WeekHours {
  const weekday = (closed = false): DayHours => ({ open: DEFAULT_OPEN, close: DEFAULT_CLOSE, closed })
  return {
    mon: weekday(),
    tue: weekday(),
    wed: weekday(),
    thu: weekday(),
    fri: weekday(),
    sat: weekday(true),
    sun: weekday(true),
  }
}

const inputCls =
  'rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white'

// IANA timezone names (the format the system actually uses). US-focused
// since the launch market is US HVAC; international zones can be added
// later if we expand. Listed roughly east-to-west.
const TIMEZONES: { value: string; label: string }[] = [
  { value: 'America/New_York',    label: 'Eastern Time — New York' },
  { value: 'America/Detroit',     label: 'Eastern Time — Detroit' },
  { value: 'America/Indianapolis',label: 'Eastern Time — Indianapolis' },
  { value: 'America/Chicago',     label: 'Central Time — Chicago' },
  { value: 'America/Denver',      label: 'Mountain Time — Denver' },
  { value: 'America/Phoenix',     label: 'Mountain Time — Phoenix (no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time — Los Angeles' },
  { value: 'America/Anchorage',   label: 'Alaska Time' },
  { value: 'Pacific/Honolulu',    label: 'Hawaii Time' },
]

type Props = {
  defaults?: { hours?: WeekHours; timezone?: string }
}

export function Step6Hours({ defaults }: Props = {}) {
  const [state, action] = useActionState(saveAndAdvance, null)
  const [hours, setHours] = useState<WeekHours>(defaults?.hours ?? defaultHours())

  const browserTz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago',
    [],
  )
  // Priority: saved timezone (resume / re-edit) → browser-detected (if in
  // our list) → Central as final fallback. The saved value path is what
  // prevents the brief "flash to Eastern" when the layout re-renders after
  // a save (revalidatePath remounts this component).
  const initialTz =
    defaults?.timezone && TIMEZONES.some((t) => t.value === defaults.timezone)
      ? defaults.timezone
      : TIMEZONES.some((t) => t.value === browserTz)
        ? browserTz
        : 'America/Chicago'
  const [tz, setTz] = useState(initialTz)

  function update(day: DayKey, patch: Partial<DayHours>) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }))
  }

  return (
    <StepShell state={state}>
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-white">
          When are you open?
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Calls outside these hours route to your after-hours plan (next step).
        </p>
      </div>

      {state && !state.ok && state.errors._ && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {state.errors._[0]}
        </p>
      )}

      <form action={action}>
        <input type="hidden" name="step" value={6} />
        <input type="hidden" name="business_hours_json" value={JSON.stringify(hours)} />
        <input type="hidden" name="timezone" value={tz} />

        <div className="mb-6 space-y-2">
          {DAYS.map(({ key, label }) => {
            const d = hours[key]
            return (
              <div
                key={key}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <span className="w-24 text-sm font-medium text-zinc-900 dark:text-white">{label}</span>
                <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={d.closed}
                    onChange={(e) => update(key, { closed: e.target.checked })}
                  />
                  Closed
                </label>
                <input
                  type="time"
                  value={d.open}
                  disabled={d.closed}
                  onChange={(e) => update(key, { open: e.target.value })}
                  className={inputCls}
                />
                <span className="text-xs text-zinc-500">to</span>
                <input
                  type="time"
                  value={d.close}
                  disabled={d.closed}
                  onChange={(e) => update(key, { close: e.target.value })}
                  className={inputCls}
                />
              </div>
            )
          })}
        </div>

        <div className="mb-6">
          <label className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">Timezone</label>
          <select
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            className={`w-full ${inputCls}`}
          >
            {TIMEZONES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">Auto-detected. Change if wrong.</p>
        </div>

        <SubmitButton>Continue</SubmitButton>
      </form>
    </StepShell>
  )
}
