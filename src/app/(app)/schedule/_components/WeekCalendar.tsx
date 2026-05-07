'use client'

import { useEffect, useRef } from 'react'
import { CaseLink } from '@/app/_components/cases/CaseLink'
import type { WeekStart } from '../_lib/week'
import { addDays } from '../_lib/week'

export type CalendarAppointment = {
  id: string
  caseId: string | null
  scheduledFor: string // ISO
  durationMin: number
  customerLastName: string
  technicianColor: string | null // null → unassigned (zinc)
  status: string
}

type Props = {
  weekStart: Date
  weekStartSetting: WeekStart
  startHour: number
  endHour: number
  // When the rendered range is taller than the viewport (24h mode),
  // the body scrolls. These two control which slice is visible by default.
  viewportStartHour?: number
  viewportEndHour?: number
  appointments: CalendarAppointment[]
}

const HOUR_PX = 48 // each hour row is 48px tall — gives ~24px per 30 min slot

// Renders a Google-Calendar-style week grid. Server passes 7-day window of
// appointments + the current settings; this component handles positioning,
// overlap math, and the day/time chrome.
export function WeekCalendar({
  weekStart,
  weekStartSetting: _ws,
  startHour,
  endHour,
  viewportStartHour,
  viewportEndHour,
  appointments,
}: Props) {
  const totalHours = endHour - startHour
  const gridHeight = totalHours * HOUR_PX

  // Scrollable viewport. When the viewport range is narrower than the full
  // rendered range, the body scrolls; otherwise it just shows everything.
  const vStart = Math.max(startHour, viewportStartHour ?? startHour)
  const vEnd = Math.min(endHour, viewportEndHour ?? endHour)
  const viewportHours = Math.max(1, vEnd - vStart)
  const viewportPx = viewportHours * HOUR_PX
  const scrollable = viewportHours < totalHours

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!scrollable || !scrollRef.current) return
    scrollRef.current.scrollTop = (vStart - startHour) * HOUR_PX
  }, [scrollable, vStart, startHour])

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Bucket appointments by day index 0..6 within this week.
  const apptsByDay: CalendarAppointment[][] = Array.from({ length: 7 }, () => [])
  for (const a of appointments) {
    const d = new Date(a.scheduledFor)
    const dayIdx = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - weekStart.getTime()) / 86_400_000)
    if (dayIdx >= 0 && dayIdx < 7) apptsByDay[dayIdx].push(a)
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Day-name header row */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-zinc-200 dark:border-zinc-800">
        <div className="border-r border-zinc-200 dark:border-zinc-800" />
        {days.map((d, i) => {
          const isToday = d.getTime() === today.getTime()
          return (
            <div
              key={i}
              className={`px-2 py-2 text-center text-xs ${
                isToday ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''
              } ${i < 6 ? 'border-r border-zinc-200 dark:border-zinc-800' : ''}`}
            >
              <div className="font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {d.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className={`mt-0.5 text-base font-semibold ${isToday ? 'text-indigo-700 dark:text-indigo-300' : 'text-zinc-900 dark:text-white'}`}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Grid body — scrolls when totalHours exceeds the visible viewport */}
      <div
        ref={scrollRef}
        className={scrollable ? 'overflow-y-auto' : ''}
        style={scrollable ? { height: viewportPx } : undefined}
      >
      <div className="grid grid-cols-[60px_repeat(7,1fr)]" style={{ height: gridHeight }}>
        {/* Time axis */}
        <div className="relative border-r border-zinc-200 dark:border-zinc-800">
          {Array.from({ length: totalHours }, (_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-zinc-100 dark:border-zinc-800/60"
              style={{ top: i * HOUR_PX, height: HOUR_PX }}
            >
              <span className="absolute right-1 -top-1.5 text-[10px] tabular-nums text-zinc-400 dark:text-zinc-600">
                {formatHour(startHour + i)}
              </span>
            </div>
          ))}
        </div>

        {/* 7 day columns */}
        {days.map((day, dayIdx) => {
          const isToday = day.getTime() === today.getTime()
          const positioned = layoutDay(apptsByDay[dayIdx], startHour, endHour)
          return (
            <div
              key={dayIdx}
              className={`relative ${isToday ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''} ${
                dayIdx < 6 ? 'border-r border-zinc-200 dark:border-zinc-800' : ''
              }`}
            >
              {/* Hour gridlines */}
              {Array.from({ length: totalHours }, (_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 border-t border-zinc-100 dark:border-zinc-800/60"
                  style={{ top: i * HOUR_PX, height: HOUR_PX }}
                />
              ))}

              {/* Appointment blocks */}
              {positioned.map(({ appt, top, height, leftPct, widthPct }) => (
                <AppointmentBlock
                  key={appt.id}
                  appt={appt}
                  top={top}
                  height={height}
                  leftPct={leftPct}
                  widthPct={widthPct}
                />
              ))}
            </div>
          )
        })}
      </div>
      </div>
    </div>
  )
}

function formatHour(h: number): string {
  if (h === 0) return '12 AM'
  if (h === 12) return '12 PM'
  if (h < 12) return `${h} AM`
  return `${h - 12} PM`
}

function formatTimeShort(d: Date): string {
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'p' : 'a'
  const hour12 = ((h + 11) % 12) + 1
  return m === 0 ? `${hour12}${ampm}` : `${hour12}:${String(m).padStart(2, '0')}${ampm}`
}

// Lays out one day's appointments. Computes top/height in px (relative to
// the column) and leftPct/widthPct (percent of column width) so overlapping
// appointments split horizontally.
type Positioned = {
  appt: CalendarAppointment
  top: number
  height: number
  leftPct: number
  widthPct: number
}

function layoutDay(appts: CalendarAppointment[], startHour: number, endHour: number): Positioned[] {
  if (appts.length === 0) return []
  const sorted = [...appts].sort((a, b) =>
    new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
  )
  // Group overlapping appointments into clusters; within a cluster, assign
  // each one to the lowest-index column where it doesn't overlap an existing
  // appointment in that column.
  type Slot = { appt: CalendarAppointment; col: number; start: number; end: number }
  const slots: Slot[] = []
  let clusterStart = 0
  let clusterEndMs = 0
  let clusterCols: number[] = [] // index → end time of last appt placed in that column

  function flushCluster() {
    const numCols = clusterCols.length
    for (let i = clusterStart; i < slots.length; i++) {
      // store cluster width on the slot via mutation
      ;(slots[i] as Slot & { _cols?: number })._cols = numCols
    }
    clusterStart = slots.length
    clusterEndMs = 0
    clusterCols = []
  }

  for (const a of sorted) {
    const start = new Date(a.scheduledFor).getTime()
    const end = start + a.durationMin * 60_000
    if (start >= clusterEndMs) flushCluster()
    let col = clusterCols.findIndex((colEnd) => colEnd <= start)
    if (col === -1) {
      col = clusterCols.length
      clusterCols.push(end)
    } else {
      clusterCols[col] = end
    }
    slots.push({ appt: a, col, start, end })
    if (end > clusterEndMs) clusterEndMs = end
  }
  flushCluster()

  // Convert to px / %.
  const dayMidnight = (() => {
    const d = new Date(sorted[0].scheduledFor)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  })()
  const rangeStartMs = dayMidnight + startHour * 3_600_000
  const rangeEndMs = dayMidnight + endHour * 3_600_000

  const out: Positioned[] = []
  for (const s of slots) {
    const numCols = ((s as Slot & { _cols?: number })._cols ?? 1)
    // Clamp to visible range so blocks outside business hours still
    // render but stay inside the grid.
    const startClamped = Math.max(s.start, rangeStartMs)
    const endClamped = Math.min(s.end, rangeEndMs)
    if (endClamped <= rangeStartMs || startClamped >= rangeEndMs) continue
    const top = ((startClamped - rangeStartMs) / 3_600_000) * HOUR_PX
    const height = Math.max(20, ((endClamped - startClamped) / 3_600_000) * HOUR_PX)
    const widthPct = 100 / numCols
    const leftPct = s.col * widthPct
    out.push({ appt: s.appt, top, height, leftPct, widthPct })
  }
  return out
}

const STATUS_RING: Record<string, string> = {
  canceled: 'opacity-50 line-through',
  no_show: 'ring-1 ring-amber-500',
  completed: 'opacity-75',
}

function AppointmentBlock({
  appt,
  top,
  height,
  leftPct,
  widthPct,
}: {
  appt: CalendarAppointment
  top: number
  height: number
  leftPct: number
  widthPct: number
}) {
  const color = appt.technicianColor ?? '#71717a' // zinc-500
  const startTime = formatTimeShort(new Date(appt.scheduledFor))
  const stateClass = STATUS_RING[appt.status] ?? ''
  const dense = height < 36

  const inner = (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight text-white shadow-sm transition-opacity hover:opacity-90 ${stateClass}`}
      style={{ backgroundColor: color, borderLeftColor: shade(color, -0.2) }}
    >
      {dense ? (
        <span className="truncate font-medium">
          {startTime} {appt.customerLastName}
        </span>
      ) : (
        <>
          <span className="truncate font-semibold">{appt.customerLastName}</span>
          <span className="truncate opacity-90">{startTime}</span>
        </>
      )}
    </div>
  )

  const wrapperStyle: React.CSSProperties = {
    position: 'absolute',
    top,
    height,
    left: `calc(${leftPct}% + 2px)`,
    width: `calc(${widthPct}% - 4px)`,
  }

  if (appt.caseId) {
    return (
      <div style={wrapperStyle}>
        <CaseLink caseId={appt.caseId} className="block h-full w-full" title={`${appt.customerLastName} · ${startTime}`}>
          {inner}
        </CaseLink>
      </div>
    )
  }
  return <div style={wrapperStyle} title={`${appt.customerLastName} · ${startTime}`}>{inner}</div>
}

// Cheap hex color shader for the left border accent. Accepts #rrggbb.
function shade(hex: string, pct: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex
  const num = parseInt(hex.slice(1), 16)
  let r = (num >> 16) & 0xff
  let g = (num >> 8) & 0xff
  let b = num & 0xff
  const adj = (c: number) => {
    if (pct < 0) return Math.max(0, Math.round(c * (1 + pct)))
    return Math.min(255, Math.round(c + (255 - c) * pct))
  }
  r = adj(r); g = adj(g); b = adj(b)
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}
