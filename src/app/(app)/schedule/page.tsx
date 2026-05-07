import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OperatorFilter, type FilterOperator } from './_components/OperatorFilter'
import { WeekNav } from './_components/WeekNav'
import { ViewSwitcher } from './_components/ViewSwitcher'
import { SettingsButton } from './_components/SettingsButton'
import { SettingsModal } from './_components/SettingsModal'
import { ScheduleSettingsForm } from './_components/ScheduleSettingsForm'
import { WeekCalendar, type CalendarAppointment } from './_components/WeekCalendar'
import {
  addDays,
  lastNameOf,
  parseWeekParam,
  timeRangeBounds,
  type ScheduleTimeRange,
  type WeekHours,
  type WeekStart,
} from './_lib/week'

type RawAppt = {
  id: string
  scheduled_for: string
  duration_min: number | null
  status: string
  case_id: string | null
  customer: { name: string | null } | null
  case: { technician_id: string | null } | null
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; tech?: string }>
}) {
  const { week: weekParam, tech: techParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) redirect('/login')

  const { data: settingsRow } = await supabase
    .from('workspace_settings')
    .select('week_start, schedule_time_range')
    .eq('workspace_id', workspace.id)
    .single()
  const weekStartSetting: WeekStart = (settingsRow?.week_start as WeekStart) ?? 'sun'
  const timeRange: ScheduleTimeRange = (settingsRow?.schedule_time_range as ScheduleTimeRange) ?? 'business'

  // Pull configured business hours from agent_configs (set in onboarding
  // Step 6 / Settings → Business hours). Used only when timeRange is
  // 'business' — falls back to 6 AM – 8 PM if missing.
  const { data: agentConfig } = await supabase
    .from('agent_configs')
    .select('business_hours')
    .eq('workspace_id', workspace.id)
    .single()
  const businessHours = (agentConfig?.business_hours as WeekHours | null) ?? null

  const { startHour, endHour } = timeRangeBounds(timeRange, businessHours)

  // In 24-hour mode, the grid renders all 24 rows but the viewport opens
  // on the same business-hours window so the user lands on the workday
  // and can scroll for after-hours.
  const viewport = timeRange === 'full'
    ? timeRangeBounds('business', businessHours)
    : { startHour, endHour }

  const weekStart = parseWeekParam(weekParam, weekStartSetting)
  const weekEnd = addDays(weekStart, 7)

  const { data: techsData } = await supabase
    .from('operators')
    .select('id, name, color, is_technician')
    .eq('workspace_id', workspace.id)
    .eq('is_technician', true)
    .order('name', { ascending: true })
  const technicians: FilterOperator[] = (techsData ?? []).map((o) => ({
    id: o.id as string,
    name: o.name as string,
    color: (o.color as string) ?? '#64748b',
  }))
  const techColorById = new Map<string, string>(technicians.map((t) => [t.id, t.color]))

  const techSelected = techParam ?? null

  const { data: rawAppts, error: apptErr } = await supabase
    .from('appointments')
    .select('id, scheduled_for, duration_min, status, case_id, customer:customers(name), case:cases(technician_id)')
    .eq('workspace_id', workspace.id)
    .gte('scheduled_for', weekStart.toISOString())
    .lt('scheduled_for', weekEnd.toISOString())
    .order('scheduled_for', { ascending: true })

  if (apptErr) {
    return (
      <div>
        <Header weekStart={weekStart} weekStartSetting={weekStartSetting} />
        <p className="mt-6 text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t load schedule — {apptErr.message}
        </p>
      </div>
    )
  }

  const all: CalendarAppointment[] = ((rawAppts ?? []) as unknown as RawAppt[]).map((r) => ({
    id: r.id,
    caseId: r.case_id,
    scheduledFor: r.scheduled_for,
    durationMin: r.duration_min ?? 60,
    customerLastName: lastNameOf(r.customer?.name ?? null),
    technicianColor: r.case?.technician_id ? (techColorById.get(r.case.technician_id) ?? '#71717a') : null,
    status: r.status,
  }))
  const techIdById = new Map<string, string | null>(
    ((rawAppts ?? []) as unknown as RawAppt[]).map((r) => [r.id, r.case?.technician_id ?? null]),
  )

  let appointments: CalendarAppointment[] = all
  if (techSelected === 'unassigned') {
    appointments = all.filter((a) => techIdById.get(a.id) === null)
  } else if (techSelected && techSelected !== 'all') {
    appointments = all.filter((a) => techIdById.get(a.id) === techSelected)
  }

  return (
    <div>
      <Header weekStart={weekStart} weekStartSetting={weekStartSetting} />

      <div className="mt-4 space-y-4">
        <OperatorFilter operators={technicians} selected={techSelected} />
        <WeekCalendar
          weekStart={weekStart}
          weekStartSetting={weekStartSetting}
          startHour={startHour}
          endHour={endHour}
          viewportStartHour={viewport.startHour}
          viewportEndHour={viewport.endHour}
          appointments={appointments}
        />
      </div>

      <SettingsModal>
        <ScheduleSettingsForm weekStart={weekStartSetting} timeRange={timeRange} />
      </SettingsModal>
    </div>
  )
}

function Header({
  weekStart,
  weekStartSetting,
}: {
  weekStart: Date
  weekStartSetting: WeekStart
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Schedule</h1>
        <div className="flex items-center gap-2">
          <ViewSwitcher />
          <SettingsButton />
        </div>
      </div>
      <WeekNav weekStart={weekStart} weekStartSetting={weekStartSetting} />
    </div>
  )
}
