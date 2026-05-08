export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type DayHours = { open: string; close: string; closed: boolean }
export type WeekHours = Record<DayKey, DayHours>

const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function defaultHours(): WeekHours {
  const weekday = (closed = false): DayHours => ({ open: '08:00', close: '17:00', closed })
  return {
    mon: weekday(), tue: weekday(), wed: weekday(),
    thu: weekday(), fri: weekday(),
    sat: weekday(true), sun: weekday(true),
  }
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
