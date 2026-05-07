'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { addDays, formatWeekLabel, formatWeekParam, parseWeekParam, type WeekStart } from '../_lib/week'

// Prev / Next / Today week navigator. Drives `?week=YYYY-MM-DD`. Today's
// click clears the param so the URL stays clean when viewing the current
// week.
export function WeekNav({
  weekStart,
  weekStartSetting,
}: {
  weekStart: Date
  weekStartSetting: WeekStart
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function go(target: Date | null) {
    const next = new URLSearchParams(searchParams.toString())
    if (target === null) next.delete('week')
    else next.set('week', formatWeekParam(target))
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const prev = addDays(weekStart, -7)
  const next = addDays(weekStart, 7)
  const todayWeek = parseWeekParam(undefined, weekStartSetting)
  const onToday = todayWeek.getTime() === weekStart.getTime()

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => go(prev)}
        aria-label="Previous week"
        className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        ←
      </button>
      <button
        type="button"
        onClick={() => go(null)}
        disabled={onToday}
        className="rounded-md border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-default disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Today
      </button>
      <button
        type="button"
        onClick={() => go(next)}
        aria-label="Next week"
        className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        →
      </button>
      <span className="ml-2 text-sm font-medium text-zinc-900 dark:text-white">
        {formatWeekLabel(weekStart)}
      </span>
    </div>
  )
}
