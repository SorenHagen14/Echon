// US holiday quick-add presets for Settings → Hours.
//
// Each preset returns the next occurrence on or after `from`. Floating
// holidays (Memorial Day, Labor Day, Thanksgiving) are computed from
// month/weekday rules; fixed-date holidays just compare month/day.
//
// The user can edit any added date afterwards — these presets just give
// a reasonable starting point so they don't have to type a date.

export type HolidayPreset = {
  id: string
  label: string
  // Returns YYYY-MM-DD for the next occurrence on or after `from`.
  nextOccurrence: (from: Date) => string
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function iso(year: number, month1: number, day: number): string {
  return `${year}-${pad(month1)}-${pad(day)}`
}

// Fixed date — picks the same month/day in the current year, or next year
// if it has already passed.
function fixed(month1: number, day: number) {
  return (from: Date): string => {
    const y = from.getFullYear()
    const target = new Date(y, month1 - 1, day)
    const todayMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate())
    return target < todayMidnight ? iso(y + 1, month1, day) : iso(y, month1, day)
  }
}

// Nth weekday of month (e.g. 4th Thursday of November). weekday: 0=Sun..6=Sat
function nthWeekday(month1: number, weekday: number, n: number) {
  return (from: Date): string => {
    const compute = (year: number) => {
      const first = new Date(year, month1 - 1, 1)
      const offset = (weekday - first.getDay() + 7) % 7
      return new Date(year, month1 - 1, 1 + offset + (n - 1) * 7)
    }
    const todayMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate())
    const thisYear = compute(from.getFullYear())
    const target = thisYear < todayMidnight ? compute(from.getFullYear() + 1) : thisYear
    return iso(target.getFullYear(), target.getMonth() + 1, target.getDate())
  }
}

// Last weekday of month (e.g. last Monday of May = Memorial Day).
function lastWeekday(month1: number, weekday: number) {
  return (from: Date): string => {
    const compute = (year: number) => {
      const last = new Date(year, month1, 0) // day 0 of next month = last day of this
      const offset = (last.getDay() - weekday + 7) % 7
      return new Date(year, month1 - 1, last.getDate() - offset)
    }
    const todayMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate())
    const thisYear = compute(from.getFullYear())
    const target = thisYear < todayMidnight ? compute(from.getFullYear() + 1) : thisYear
    return iso(target.getFullYear(), target.getMonth() + 1, target.getDate())
  }
}

// Day after the 4th Thursday of November.
function dayAfterThanksgiving(from: Date): string {
  const compute = (year: number) => {
    const nov1 = new Date(year, 10, 1)
    const offset = (4 - nov1.getDay() + 7) % 7 // Thursday = 4
    const thanks = new Date(year, 10, 1 + offset + 3 * 7)
    return new Date(year, 10, thanks.getDate() + 1)
  }
  const todayMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const thisYear = compute(from.getFullYear())
  const target = thisYear < todayMidnight ? compute(from.getFullYear() + 1) : thisYear
  return iso(target.getFullYear(), target.getMonth() + 1, target.getDate())
}

export const HOLIDAY_PRESETS: HolidayPreset[] = [
  { id: 'new_years_day',     label: "New Year's Day",        nextOccurrence: fixed(1, 1) },
  { id: 'memorial_day',      label: 'Memorial Day',          nextOccurrence: lastWeekday(5, 1) },
  { id: 'independence_day',  label: 'Independence Day',      nextOccurrence: fixed(7, 4) },
  { id: 'labor_day',         label: 'Labor Day',             nextOccurrence: nthWeekday(9, 1, 1) },
  { id: 'thanksgiving',      label: 'Thanksgiving',          nextOccurrence: nthWeekday(11, 4, 4) },
  { id: 'day_after_thanks',  label: 'Day after Thanksgiving',nextOccurrence: dayAfterThanksgiving },
  { id: 'christmas_eve',     label: 'Christmas Eve',         nextOccurrence: fixed(12, 24) },
  { id: 'christmas_day',     label: 'Christmas Day',         nextOccurrence: fixed(12, 25) },
  { id: 'new_years_eve',     label: "New Year's Eve",        nextOccurrence: fixed(12, 31) },
]
