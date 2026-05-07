import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CustomerLink } from '@/app/_components/customer-profile/CustomerLink'
import { CallLink } from '@/app/_components/calls/CallLink'

type CallRow = {
  id: string
  started_at: string
  duration_sec: number | null
  outcome: string
  caller_phone: string | null
  service_requested: string | null
  recording_url: string | null
  customer: { id: string; name: string | null } | null
  appointments: { scheduled_for: string }[] | null
}

const OUTCOME_BADGES: Record<string, { label: string; className: string }> = {
  booked: { label: 'Booked', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  quote_requested: { label: 'Quote requested', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  escalated: { label: 'Escalated', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  no_action: { label: 'No action', className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' },
  hung_up: { label: 'Hung up', className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  processing: { label: 'Processing', className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
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

function formatStarted(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatAppointment(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default async function CallsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) redirect('/login')

  const { data, error } = await supabase
    .from('calls')
    .select('id, started_at, duration_sec, outcome, caller_phone, service_requested, recording_url, customer:customers(id, name), appointments(scheduled_for)')
    .eq('workspace_id', workspace.id)
    .order('started_at', { ascending: false })
    .limit(50)

  const calls = ((data ?? []) as unknown as CallRow[])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Calls</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Showing latest {calls.length}
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t load calls — {error.message}
        </p>
      ) : calls.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-300 bg-white px-6 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-900 dark:text-white">No calls yet</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Once your number is live, calls will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left font-medium">Time</th>
                <th scope="col" className="px-4 py-2.5 text-left font-medium">Customer</th>
                <th scope="col" className="px-4 py-2.5 text-left font-medium">Duration</th>
                <th scope="col" className="px-4 py-2.5 text-left font-medium">Service</th>
                <th scope="col" className="px-4 py-2.5 text-left font-medium">Outcome</th>
                <th scope="col" className="px-4 py-2.5 text-left font-medium">Appointment</th>
                <th scope="col" className="px-4 py-2.5 text-left font-medium">Rec.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {calls.map((call) => {
                const badge = OUTCOME_BADGES[call.outcome] ?? OUTCOME_BADGES.processing
                const appointment = call.outcome === 'booked' && call.appointments && call.appointments.length > 0
                  ? call.appointments[0]
                  : null
                return (
                  <tr
                    key={call.id}
                    className="cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      <CallLink callId={call.id} className="block w-full text-left">{formatStarted(call.started_at)}</CallLink>
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">
                      {call.customer?.id ? (
                        <CustomerLink
                          customerId={call.customer.id}
                          className="block text-left hover:underline"
                        >
                          {call.customer.name ?? formatPhone(call.caller_phone)}
                          {call.customer.name && (
                            <span className="ml-1 font-normal text-zinc-500 dark:text-zinc-400">
                              · {formatPhone(call.caller_phone)}
                            </span>
                          )}
                        </CustomerLink>
                      ) : (
                        <CallLink callId={call.id} className="block w-full text-left">
                          {formatPhone(call.caller_phone)}
                        </CallLink>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                      <CallLink callId={call.id} className="block w-full text-left">{formatDuration(call.duration_sec)}</CallLink>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      <CallLink callId={call.id} className="block w-full text-left">
                        {call.service_requested ?? <span className="text-zinc-400 dark:text-zinc-600">—</span>}
                      </CallLink>
                    </td>
                    <td className="px-4 py-3">
                      <CallLink callId={call.id} className="block w-full text-left">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      </CallLink>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      <CallLink callId={call.id} className="block w-full text-left">
                        {appointment ? formatAppointment(appointment.scheduled_for) : <span className="text-zinc-400 dark:text-zinc-600">—</span>}
                      </CallLink>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      <CallLink callId={call.id} className="block w-full text-left">
                        {call.recording_url ? '▶' : <span className="text-zinc-400 dark:text-zinc-600">—</span>}
                      </CallLink>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        Filters, search, and CSV export coming next.
      </p>
    </div>
  )
}
