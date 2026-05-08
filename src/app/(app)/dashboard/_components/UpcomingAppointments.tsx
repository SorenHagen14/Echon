import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type AppointmentRow = {
  id: string
  scheduled_for: string
  duration_min: number | null
  service_type: string
  service_address: string | null
  status: string
  call_id: string | null
  customer: { name: string | null; primary_phone: string | null; address: string | null } | null
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  booked:      { label: 'Booked',     className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  rescheduled: { label: 'Rescheduled', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  completed:   { label: 'Completed',  className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' },
  canceled:    { label: 'Canceled',   className: 'bg-zinc-100 text-zinc-500 line-through dark:bg-zinc-800 dark:text-zinc-500' },
  no_show:     { label: 'No-show',    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatPhone(e164: string | null): string {
  if (!e164) return ''
  const digits = e164.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return e164
}

// Buckets an appointment into Today / Tomorrow / Later, in the server's
// local timezone. "Later" only renders when explicitly requested — the
// dashboard section caps at today + tomorrow per the wireframe.
function dayBucket(iso: string): 'today' | 'tomorrow' | 'later' {
  const d = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const tomorrow = today + 86_400_000
  const dayAfter = today + 2 * 86_400_000
  const t = d.getTime()
  if (t >= today && t < tomorrow) return 'today'
  if (t >= tomorrow && t < dayAfter) return 'tomorrow'
  return 'later'
}

export async function UpcomingAppointments({ workspaceId }: { workspaceId: string }) {
  const supabase = await createClient()

  // Today + tomorrow only — anything further out lives on /schedule.
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfTomorrow = new Date(startOfToday.getTime() + 2 * 86_400_000)

  const { data, error } = await supabase
    .from('appointments')
    .select('id, scheduled_for, duration_min, service_type, service_address, status, call_id, customer:customers(name, primary_phone, address)')
    .eq('workspace_id', workspaceId)
    .gte('scheduled_for', startOfToday.toISOString())
    .lt('scheduled_for', endOfTomorrow.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(8)

  if (error) {
    return (
      <Section title="Upcoming appointments">
        <p className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t load appointments — {error.message}
        </p>
      </Section>
    )
  }

  const rows = (data ?? []) as unknown as AppointmentRow[]

  if (rows.length === 0) {
    return (
      <Section title="Upcoming appointments">
        <div className="rounded-md border border-dashed border-zinc-300 bg-white px-6 py-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nothing scheduled today or tomorrow.
          </p>
        </div>
      </Section>
    )
  }

  // Group rows so we can drop a "Today" / "Tomorrow" header before the first
  // row of each bucket. Rows arrive sorted ascending.
  type Grouped = { bucket: 'today' | 'tomorrow'; row: AppointmentRow; firstOfBucket: boolean }
  const grouped: Grouped[] = []
  let lastBucket: 'today' | 'tomorrow' | null = null
  for (const row of rows) {
    const bucket = dayBucket(row.scheduled_for)
    if (bucket === 'later') continue
    grouped.push({ bucket, row, firstOfBucket: bucket !== lastBucket })
    lastBucket = bucket
  }

  return (
    <Section title="Upcoming appointments">
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {grouped.map(({ bucket, row, firstOfBucket }) => {
            const badge = STATUS_BADGES[row.status] ?? STATUS_BADGES.booked
            const customerName = row.customer?.name ?? formatPhone(row.customer?.primary_phone ?? null) ?? 'Unknown'
            const address = row.service_address ?? row.customer?.address ?? null
            const isClickable = !!row.call_id

            const rowInner = (
              <>
                <span className="w-20 shrink-0 tabular-nums text-zinc-700 dark:text-zinc-300">
                  {formatTime(row.scheduled_for)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-zinc-900 dark:text-white">{customerName}</div>
                  <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {row.service_type}
                    {address && <> · {address}</>}
                  </div>
                </div>
                <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                  {badge.label}
                </span>
              </>
            )

            return (
              <li key={row.id}>
                {firstOfBucket && (
                  <div className="bg-zinc-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                    {bucket === 'today' ? 'Today' : 'Tomorrow'}
                  </div>
                )}
                {isClickable ? (
                  <Link
                    href={`/calls/${row.call_id}`}
                    className="flex items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    {rowInner}
                  </Link>
                ) : (
                  <div className="flex items-center gap-4 px-4 py-3 text-sm">
                    {rowInner}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
      <div className="mt-2 text-right">
        <Link
          href="/schedule"
          className="text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
        >
          View all in Schedule →
        </Link>
      </div>
    </Section>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  )
}
