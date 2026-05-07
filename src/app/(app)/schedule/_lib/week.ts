// Week math + range helpers for /schedule.
// All week boundaries are local-time midnight on the configured start day.

export type WeekStart = 'sat' | 'sun' | 'mon'
export type ScheduleTimeRange = 'business' | 'full'

const DAY_MS = 86_400_000

// Day-of-week index: Sun=0, Mon=1, ... Sat=6.
const WEEK_START_DOW: Record<WeekStart, number> = { sun: 0, mon: 1, sat: 6 }

// Returns local-time midnight at the start of the week containing `date`.
export function startOfWeek(date: Date, weekStart: WeekStart): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const startDow = WEEK_START_DOW[weekStart]
  const offset = (d.getDay() - startDow + 7) % 7
  d.setDate(d.getDate() - offset)
  return d
}

// Parses ?week=YYYY-MM-DD as a local-time date. Falls back to today's week
// start. Always snaps to the configured start of week (so a stale URL with a
// mid-week date still produces a valid week boundary).
export function parseWeekParam(raw: string | undefined, weekStart: WeekStart): Date {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number)
    const parsed = new Date(y, (m ?? 1) - 1, d ?? 1)
    if (!Number.isNaN(parsed.getTime())) return startOfWeek(parsed, weekStart)
  }
  return startOfWeek(new Date(), weekStart)
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

export function formatWeekParam(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatWeekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6)
  const sameMonth = weekStart.getMonth() === end.getMonth()
  const startStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endStr = end.toLocaleDateString('en-US', sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })
  return `${startStr} – ${endStr}, ${end.getFullYear()}`
}

type DayHours = { open?: string; close?: string; closed?: boolean }
export type WeekHours = Record<string, DayHours>

// Computes the earliest open hour and latest close hour across all
// non-closed days of `business_hours`. Used by the /schedule grid when the
// time-range setting is 'business'. Falls back to 6 AM – 8 PM if no hours
// are configured (or every day is marked closed).
export function businessHoursWindow(hours: WeekHours | null | undefined): { startHour: number; endHour: number } {
  if (!hours) return { startHour: 6, endHour: 20 }
  let earliest = 24
  let latest = 0
  for (const day of Object.values(hours)) {
    if (!day || day.closed) continue
    const open = parseHour(day.open)
    const close = parseHour(day.close)
    if (open !== null && open < earliest) earliest = open
    if (close !== null && close > latest) latest = Math.ceil(close)
  }
  if (earliest >= latest) return { startHour: 6, endHour: 20 }
  return { startHour: Math.floor(earliest), endHour: Math.min(24, latest) }
}

function parseHour(hhmm: string | undefined): number | null {
  if (!hhmm) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  const h = Number(m[1])
  const mins = Number(m[2])
  return h + mins / 60
}

export function timeRangeBounds(
  range: ScheduleTimeRange,
  businessHours: WeekHours | null | undefined,
): { startHour: number; endHour: number } {
  if (range === 'full') return { startHour: 0, endHour: 24 }
  return businessHoursWindow(businessHours)
}

export const _DAY_MS = DAY_MS

export function lastNameOf(full: string | null): string {
  if (!full) return 'Unknown'
  const parts = full.trim().split(/\s+/)
  return parts[parts.length - 1] ?? 'Unknown'
}
