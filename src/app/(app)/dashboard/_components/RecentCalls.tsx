import { createClient } from '@/lib/supabase/server'
import { CustomerLink } from '@/app/_components/customer-profile/CustomerLink'
import { CallLink } from '@/app/_components/calls/CallLink'

type CallRow = {
  id: string
  started_at: string
  duration_sec: number | null
  outcome: string
  caller_phone: string | null
  summary: string | null
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

function formatDuration(sec: number | null): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
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

// Split "• line one\n• line two" (or plain lines) into trimmed bullet lines.
function summaryLines(summary: string | null): string[] {
  if (!summary) return []
  return summary
    .split('\n')
    .map((l) => l.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean)
}

export async function RecentCalls({ workspaceId }: { workspaceId: string }) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('calls')
    .select('id, started_at, duration_sec, outcome, caller_phone, summary, customer:customers(id, name), appointments(scheduled_for, service_type)')
    .eq('workspace_id', workspaceId)
    .order('started_at', { ascending: false })
    .limit(10)

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
        <div className="rounded-md border border-dashed border-zinc-300 bg-white px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-900 dark:text-white">
            Your number is live
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            We&apos;ll show calls here as they come in.
          </p>
        </div>
      </Section>
    )
  }

  // Repeat-caller detection: any caller_phone that appears 2+ times in the last
  // 7 days needs human eyes. Computed from a single workspace-scoped query so
  // we catch repeats even when not all instances are in the limit-10 window.
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { data: recentByPhone } = await supabase
    .from('calls')
    .select('caller_phone')
    .eq('workspace_id', workspaceId)
    .gte('started_at', sevenDaysAgo)
    .not('caller_phone', 'is', null)

  const phoneCounts = new Map<string, number>()
  recentByPhone?.forEach((row) => {
    const p = row.caller_phone as string | null
    if (!p) return
    phoneCounts.set(p, (phoneCounts.get(p) ?? 0) + 1)
  })
  const repeatPhones = new Set(
    Array.from(phoneCounts.entries()).filter(([, n]) => n >= 2).map(([p]) => p),
  )

  return (
    <Section title="Recent calls">
      <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {calls.map((call) => {
          const badge = OUTCOME_BADGES[call.outcome] ?? OUTCOME_BADGES.processing
          const name = call.customer?.name ?? formatPhone(call.caller_phone)
          const isRepeat = call.caller_phone ? repeatPhones.has(call.caller_phone) : false
          const repeatCount = call.caller_phone ? phoneCounts.get(call.caller_phone) ?? 0 : 0
          const bullets = summaryLines(call.summary)
          const appointment = call.outcome === 'booked' && call.appointments && call.appointments.length > 0
            ? call.appointments[0]
            : null

          return (
            <li key={call.id} className="flex transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
              <span className={`w-1 shrink-0 ${badge.bar}`} aria-hidden="true" />
              <div className="flex-1 px-4 py-3 text-sm">
                {/* Top row — customer name is its own click target (opens
                    customer modal); the badge is a CallLink (opens call
                    modal). Two distinct sibling buttons; no nesting. */}
                <div className="flex items-center gap-3">
                  {call.customer?.id ? (
                    <CustomerLink
                      customerId={call.customer.id}
                      className="flex-1 truncate text-left font-medium text-zinc-900 hover:underline dark:text-white"
                    >
                      {name}
                    </CustomerLink>
                  ) : (
                    <span className="flex-1 truncate font-medium text-zinc-900 dark:text-white">
                      {name}
                    </span>
                  )}
                  {isRepeat && (
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      title={`Called ${repeatCount} times in the last 7 days — consider human follow-up`}
                    >
                      Repeat caller · {repeatCount}×
                    </span>
                  )}
                  <CallLink
                    callId={call.id}
                    className={`inline-flex shrink-0 justify-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                  >
                    {badge.label}
                    {appointment && (
                      <span className="ml-1 font-normal opacity-90">
                        · {formatAppointment(appointment.scheduled_for)}
                      </span>
                    )}
                  </CallLink>
                </div>

                {/* Rest of the row — bullets + relative time — is one
                    big CallLink so most of the row stays clickable. */}
                <CallLink callId={call.id} className="mt-1.5 block w-full text-left">
                  {bullets.length > 0 && (
                    <ul className="space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                      {bullets.slice(0, 2).map((b, i) => (
                        <li key={i} className="flex gap-1.5">
                          <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-600">•</span>
                          <span className="truncate">{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>{formatRelativeTime(call.started_at)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{formatDuration(call.duration_sec)}</span>
                  </div>
                </CallLink>
              </div>
            </li>
          )
        })}
      </ul>
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
