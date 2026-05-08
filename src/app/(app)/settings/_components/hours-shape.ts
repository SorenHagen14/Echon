export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type DayHours = { open: string; close: string; closed: boolean }
export type WeekHours = Record<DayKey, DayHours>

export type Holiday = { date: string; label: string } // YYYY-MM-DD

const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function defaultHours(): WeekHours {
  const weekday = (closed = false): DayHours => ({ open: '08:00', close: '17:00', closed })
  return {
    mon: weekday(), tue: weekday(), wed: weekday(),
    thu: weekday(), fri: weekday(),
    sat: weekday(true), sun: weekday(true),
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function normalizeHolidays(raw: unknown): Holiday[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  return raw
    .map((r): Holiday | null => {
      if (!r || typeof r !== 'object') return null
      const o = r as Record<string, unknown>
      const date = typeof o.date === 'string' && ISO_DATE.test(o.date) ? o.date : null
      const label = typeof o.label === 'string' ? o.label.trim() : ''
      if (!date) return null
      if (seen.has(date)) return null
      seen.add(date)
      return { date, label: label.slice(0, 80) || 'Closed' }
    })
    .filter((h): h is Holiday => h !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function buildInitialHours(raw: unknown): WeekHours {
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    const ok = DAY_KEYS.every((key) => {
      const d = r[key] as Record<string, unknown> | undefined
      return d && typeof d.open === 'string' && typeof d.close === 'string' && typeof d.closed === 'boolean'
    })
    if (ok) return r as unknown as WeekHours
  }
  return defaultHours()
}
