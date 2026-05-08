import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CallLink } from '@/app/_components/calls/CallLink'

type CallRow = {
  id: string
  started_at: string
  duration_sec: number | null
  outcome: string
  caller_phone: string | null
  customer: { id: string; name: string | null } | null
  appointments: { scheduled_for: string; service_type: string | null }[] | null
}

const OUTCOME_BADGES: Record<string, { label: string; className: string; bar: string }> = {
  booked: {
    label: 'Booked',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    bar: 'bg-emerald-500',
  },
  quote_requested: {
    label: 'Quote requested',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    bar: 'bg-blue-500',
  },
  escalated: {
    label: 'Escalated',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    bar: 'bg-amber-500',
  },
  no_action: {
    label: 'No action',
    className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    bar: 'bg-zinc-300 dark:bg-zinc-700',
  },
  hung_up: {
    label: 'Hung up',
    className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
    bar: 'bg-zinc-300 dark:bg-zinc-700',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    bar: 'bg-red-500',
  },
  processing: {
    label: 'Processing',
    className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
    bar: 'bg-zinc-300 dark:bg-zinc-700',
  },
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatPhone(e164: string | null): string {
  if (!e164) return 'Unknown'
  const digits = e164.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return e164
}

// "Tue 2pm" / "Today 3pm" / "May 11, 10am" — for the booked-appointment hint.
function formatAppointment(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((d.getTime() - now.setHours(0, 0, 0, 0)) / 86_400_000)
  const hour = d.getHours()
  const minute = d.getMinutes()
  const ampm = hour >= 12 ? 'pm' : 'am'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  const time = minute === 0 ? `${h12}${ampm}` : `${h12}:${String(minute).padStart(2, '0')}${ampm}`
  if (diffDays === 0) return `Today ${time}`
  if (diffDays === 1) return `Tomorrow ${time}`
  if (diffDays > 1 && diffDays < 7) return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`
}

export async function RecentCalls({ workspaceId }: { workspaceId: string }) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('calls')
    .select('id, started_at, duration_sec, outcome, caller_phone, customer:customers(id, name), appointments(scheduled_for, service_type)')
    .eq('workspace_id', workspaceId)
    .order('started_at', { ascending: false })
    .limit(5)

  if (error) {
    return (
      <Section title="Recent calls">
        <p className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t load calls — {error.message}
        </p>
      </Section>
    )
  }

  const calls = (data ?? []) as unknown as CallRow[]

  if (calls.length === 0) {
    return (
      <Section title="Recent calls">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          We&apos;ll show calls here as they come in.
        </p>
      </Section>
    )
  }

  return (
    <Section title="Recent calls">
      <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {calls.map((call) => {
          const badge = OUTCOME_BADGES[call.outcome] ?? OUTCOME_BADGES.processing
          const name = call.customer?.name ?? formatPhone(call.caller_phone)
          const appointment = call.outcome === 'booked' && call.appointments && call.appointments.length > 0
            ? call.appointments[0]
            : null

          return (
            <li key={call.id} className="flex transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
              <span className={`w-1 shrink-0 ${badge.bar}`} aria-hidden="true" />
              <CallLink callId={call.id} className="flex flex-1 items-center gap-3 px-4 py-3 text-sm">
                <span className="flex-1 truncate font-medium text-zinc-900 dark:text-white">
                  {name}
                </span>
                <span
                  className={`inline-flex shrink-0 justify-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                >
                  {badge.label}
                  {appointment && (
                    <span className="ml-1 font-normal opacity-90">
                      · {formatAppointment(appointment.scheduled_for)}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  {formatRelativeTime(call.started_at)}
                </span>
              </CallLink>
            </li>
          )
        })}
      </ul>
      <div className="mt-2 text-right">
        <Link
          href="/calls"
          className="text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
        >
          View all in Calls →
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
