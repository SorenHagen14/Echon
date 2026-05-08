import type { ToolHandler } from './types'

type DayHours = { open?: string; close?: string; closed?: boolean }

// check_availability({ from_iso, to_iso, duration_min }) — returns a
// short list of available time windows the agent can offer. Computed
// from business hours + existing appointments. No external calendar
// integration yet (blocked on Google Calendar OAuth) but already
// usable: the agent can offer slots that don't double-book operators
// inside this workspace's own database.
export const checkAvailability: ToolHandler = async (ctx, args) => {
  const fromIso = typeof args.from_iso === 'string' ? args.from_iso : new Date().toISOString()
  const toIso = typeof args.to_iso === 'string'
    ? args.to_iso
    : new Date(Date.parse(fromIso) + 7 * 86_400_000).toISOString()
  const duration = typeof args.duration_min === 'number' && args.duration_min > 0
    ? Math.round(args.duration_min)
    : 60

  const start = new Date(fromIso)
  const end = new Date(toIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { result: 'Invalid date range. Ask the caller to rephrase ("tomorrow afternoon", "next Tuesday morning").' }
  }

  // Pull the workspace's business hours + timezone + existing booked
  // appointments in this window.
  const [{ data: cfg }, { data: existingAppts }] = await Promise.all([
    ctx.supabase
      .from('agent_configs')
      .select('business_hours, timezone, holidays')
      .eq('workspace_id', ctx.workspaceId)
      .single(),
    ctx.supabase
      .from('appointments')
      .select('scheduled_for, duration_min, status')
      .eq('workspace_id', ctx.workspaceId)
      .gte('scheduled_for', start.toISOString())
      .lt('scheduled_for', end.toISOString())
      .neq('status', 'canceled'),
  ])

  const hours = (cfg?.business_hours as Record<string, DayHours> | null) ?? null
  const holidayDates = new Set(
    Array.isArray(cfg?.holidays)
      ? (cfg!.holidays as Array<{ date?: string }>).map((h) => h.date ?? '').filter(Boolean)
      : [],
  )

  // Cluster booked appointments into a sorted list for fast overlap checks.
  const booked = (existingAppts ?? []).map((a) => {
    const s = new Date(a.scheduled_for as string).getTime()
    const dur = (a.duration_min as number | null) ?? 60
    return { start: s, end: s + dur * 60_000 }
  }).sort((a, b) => a.start - b.start)

  function overlaps(slotStart: number, slotEnd: number): boolean {
    for (const b of booked) {
      if (slotStart < b.end && b.start < slotEnd) return true
    }
    return false
  }

  const dayKeys: Array<keyof Record<string, DayHours>> = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const slots: string[] = []
  // Walk the requested window day by day; offer up to 3 slots inside
  // each day's business hours. Stop once we have 4 candidates total.
  const cursor = new Date(start)
  cursor.setSeconds(0, 0)
  const stop = end.getTime()

  while (cursor.getTime() < stop && slots.length < 4) {
    const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    const isHoliday = holidayDates.has(dateStr)
    const dayHours = hours?.[dayKeys[cursor.getDay()] as string]

    if (!isHoliday && dayHours && !dayHours.closed && dayHours.open && dayHours.close) {
      const [openH, openM] = dayHours.open.split(':').map(Number)
      const [closeH, closeM] = dayHours.close.split(':').map(Number)
      const dayOpen = new Date(cursor)
      dayOpen.setHours(openH, openM, 0, 0)
      const dayClose = new Date(cursor)
      dayClose.setHours(closeH, closeM, 0, 0)
      // Don't propose slots in the past — clamp to "now" if we're on today.
      const now = Date.now()
      const earliest = Math.max(dayOpen.getTime(), now + 30 * 60_000) // 30-min lead time
      const latest = dayClose.getTime() - duration * 60_000

      // Try every 30 minutes — keep the first 3 non-overlapping.
      let dailyCount = 0
      for (let t = earliest; t <= latest && dailyCount < 3 && slots.length < 4; t += 30 * 60_000) {
        if (!overlaps(t, t + duration * 60_000)) {
          slots.push(new Date(t).toLocaleString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit',
            timeZone: (cfg?.timezone as string | null) ?? undefined,
          }))
          dailyCount++
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1)
    cursor.setHours(0, 0, 0, 0)
  }

  if (slots.length === 0) {
    return {
      result: 'No availability in that window. Try a wider range, or escalate so a human can squeeze them in.',
    }
  }
  return {
    result: `Available slots (${duration} min each): ${slots.join('; ')}. Offer two of these and ask which works.`,
  }
}

export const checkAvailabilityToolDef = {
  type: 'function' as const,
  function: {
    name: 'check_availability',
    description:
      'Find open appointment slots in the workspace calendar. Call this BEFORE proposing a specific time so you don\'t double-book. Returns 2-4 candidate slots formatted in the workspace timezone.',
    parameters: {
      type: 'object',
      properties: {
        from_iso: {
          type: 'string',
          description: 'Start of the search window, ISO 8601. Default: now.',
        },
        to_iso: {
          type: 'string',
          description: 'End of the search window, ISO 8601. Default: 7 days from now.',
        },
        duration_min: {
          type: 'number',
          description: 'Appointment length in minutes. Default 60.',
        },
      },
    },
  },
}
