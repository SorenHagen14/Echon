'use client'

import { useActionState, useMemo, useState } from 'react'
import { updateBusinessHours, type HoursResult } from '../hours-actions'
import type { DayKey, DayHours, WeekHours, Holiday } from './hours-shape'
import { HOLIDAY_PRESETS } from './holiday-presets'

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

type Props = {
  initial: { hours: WeekHours; timezone: string | null; holidays: Holiday[] }
}

function formatHolidayDate(iso: string): string {
  // YYYY-MM-DD → "Mon, Jul 4 2026". Built without `new Date(iso)` so we
  // don't get tripped up by browser-local TZ shifting the date.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3])
  const dt = new Date(y, mo, d)
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export function HoursSection({ initial }: Props) {
  const [hours, setHours] = useState<WeekHours>(initial.hours)
  const [holidays, setHolidays] = useState<Holiday[]>(initial.holidays)
  const [adding, setAdding] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newLabel, setNewLabel] = useState('')
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

  function addHoliday(date: string, label: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return
    const trimmed = label.trim().slice(0, 80) || 'Closed'
    setHolidays((prev) => {
      if (prev.some((h) => h.date === date)) return prev
      return [...prev, { date, label: trimmed }].sort((a, b) => a.date.localeCompare(b.date))
    })
  }

  function removeHoliday(date: string) {
    setHolidays((prev) => prev.filter((h) => h.date !== date))
  }

  function updateHolidayLabel(date: string, label: string) {
    setHolidays((prev) => prev.map((h) => (h.date === date ? { ...h, label } : h)))
  }

  const usedHolidayDates = new Set(holidays.map((h) => h.date))

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="business_hours_json" value={JSON.stringify(hours)} />
      <input type="hidden" name="timezone" value={tz} />
      <input type="hidden" name="holidays_json" value={JSON.stringify(holidays)} />

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

      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-white">Holidays</h3>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          One-off closures. Calls on these dates follow your after-hours rules
          regardless of the day of the week.
        </p>

        {holidays.length === 0 && (
          <p className="mb-4 rounded-md border border-dashed border-zinc-300 px-3 py-4 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No holidays yet. Use a quick-add chip below or add a custom date.
          </p>
        )}

        {holidays.length > 0 && (
          <ul className="mb-4 space-y-2">
            {holidays.map((h) => (
              <li
                key={h.date}
                className="flex flex-wrap items-center gap-3 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <span className="w-44 text-sm font-medium text-zinc-900 dark:text-white">
                  {formatHolidayDate(h.date)}
                </span>
                <input
                  type="text"
                  value={h.label}
                  onChange={(e) => updateHolidayLabel(h.date, e.target.value)}
                  maxLength={80}
                  placeholder="Label (e.g. Christmas Day)"
                  className={`flex-1 ${inputCls}`}
                />
                <button
                  type="button"
                  onClick={() => removeHoliday(h.date)}
                  className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3">
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">Quick add</p>
            <div className="flex flex-wrap gap-2">
              {HOLIDAY_PRESETS.map((p) => {
                const date = p.nextOccurrence(new Date())
                const used = usedHolidayDates.has(date)
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={used}
                    onClick={() => addHoliday(date, p.label)}
                    title={used ? 'Already added' : `Add ${p.label} (${date})`}
                    className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:disabled:hover:bg-zinc-900"
                  >
                    + {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {adding ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className={inputCls}
              />
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Label"
                maxLength={80}
                className={`flex-1 ${inputCls}`}
              />
              <button
                type="button"
                onClick={() => {
                  if (!newDate) return
                  addHoliday(newDate, newLabel)
                  setNewDate('')
                  setNewLabel('')
                  setAdding(false)
                }}
                className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setAdding(false); setNewDate(''); setNewLabel('') }}
                className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="text-xs font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
            >
              + Add custom holiday
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

