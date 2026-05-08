'use client'

import { useActionState, useMemo, useState } from 'react'
import { updateBusinessHours, type HoursResult } from '../hours-actions'

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

const inputCls =
  'rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white'

function defaultHours(): WeekHours {
  const weekday = (closed = false): DayHours => ({ open: '08:00', close: '17:00', closed })
  return {
    mon: weekday(), tue: weekday(), wed: weekday(),
    thu: weekday(), fri: weekday(),
    sat: weekday(true), sun: weekday(true),
  }
}

type Props = {
  initial: { hours: WeekHours; timezone: string | null }
}

export function HoursSection({ initial }: Props) {
  const [hours, setHours] = useState<WeekHours>(initial.hours)
  const browserTz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago',
    [],
  )
  const initialTz =
    initial.timezone && TIMEZONES.some((t) => t.value === initial.timezone)
      ? initial.timezone
      : TIMEZONES.some((t) => t.value === browserTz)
        ? browserTz
        : 'America/Chicago'
  const [tz, setTz] = useState(initialTz)
  const [state, formAction, pending] = useActionState<HoursResult | null, FormData>(
    updateBusinessHours,
    null,
  )

  function update(day: DayKey, patch: Partial<DayHours>) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }))
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="business_hours_json" value={JSON.stringify(hours)} />
      <input type="hidden" name="timezone" value={tz} />

      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Weekly hours</h3>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          Calls outside these hours follow your after-hours rules.
        </p>
        <div className="space-y-2">
          {DAYS.map(({ key, label }) => {
            const d = hours[key]
            return (
              <div
                key={key}
                className="flex flex-wrap items-center gap-3 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
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
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Timezone</h3>
        <select
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          className={`w-full ${inputCls}`}
        >
          {TIMEZONES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Used to interpret your weekly hours and on-call windows.
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-5 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        <p className="font-medium text-zinc-700 dark:text-zinc-300">Holidays</p>
        <p className="mt-1 text-xs">One-off closures (e.g. Christmas, July 4th) — coming soon.</p>
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

export function buildInitialHours(raw: unknown): WeekHours {
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    const ok = DAYS.every(({ key }) => {
      const d = r[key] as Record<string, unknown> | undefined
      return d && typeof d.open === 'string' && typeof d.close === 'string' && typeof d.closed === 'boolean'
    })
    if (ok) return r as unknown as WeekHours
  }
  return defaultHours()
}
