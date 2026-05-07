import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SortPicker } from './_components/SortPicker'
import { SORT_OPTIONS, type SortKey } from './_components/sort-options'
import { OpenFollowUpToggle } from './_components/OpenFollowUpToggle'
import { CustomerLink } from '@/app/_components/customer-profile/CustomerLink'

type CustomerRow = {
  id: string
  name: string | null
  primary_phone: string | null
  email: string | null
  address: string | null
  created_at: string
}

type CallRow = {
  customer_id: string | null
  caller_phone: string | null
  outcome: string
  started_at: string
}

type AppointmentRow = {
  customer_id: string
  status: string
  scheduled_for: string
}

const VALID_SORTS = new Set(SORT_OPTIONS.map((o) => o.value))

function formatPhone(e164: string | null): string {
  if (!e164) return ''
  const digits = e164.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return e164
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return 'Never'
  const diffMs = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diffMs / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; open?: string; q?: string }>
}) {
  const params = await searchParams
  const sort: SortKey = params.sort && VALID_SORTS.has(params.sort as SortKey)
    ? (params.sort as SortKey)
    : 'recent'
  const openOnly = params.open === '1'
  const q = params.q?.trim() ?? ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) redirect('/login')

  // Pull customers + every call/appointment for the workspace, then aggregate
  // in JS. Fine at MVP scale; a Postgres view becomes worthwhile once
  // workspaces accumulate thousands of customers.
  const [customersRes, callsRes, apptsRes] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, primary_phone, email, address, created_at')
      .eq('workspace_id', workspace.id),
    supabase
      .from('calls')
      .select('customer_id, caller_phone, outcome, started_at')
      .eq('workspace_id', workspace.id),
    supabase
      .from('appointments')
      .select('customer_id, status, scheduled_for')
      .eq('workspace_id', workspace.id),
  ])

  if (customersRes.error) {
    return (
      <Wrapper sort={sort} openOnly={openOnly} q={q}>
        <p className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t load customers — {customersRes.error.message}
        </p>
      </Wrapper>
    )
  }

  const customers = (customersRes.data ?? []) as CustomerRow[]
  const calls = (callsRes.data ?? []) as CallRow[]
  const appointments = (apptsRes.data ?? []) as AppointmentRow[]

  // Aggregate per-customer counters: total calls, last contact, has open
  // follow-up. "Open follow-up" = customer has at least one call with
  // outcome 'quote_requested' AND no booked or completed appointment from
  // them with scheduled_for after that call. Approximation — a quote that
  // led to a booking 30 days later still flags the customer briefly, which
  // is fine.
  type Aggregate = {
    callCount: number
    lastContact: string | null
    hasQuoteRequest: boolean
    earliestQuoteAt: string | null
    hasFutureBooking: boolean
  }
  const agg = new Map<string, Aggregate>()
  // We also support unknown-caller calls by phone — surface them as
  // pseudo-customers? For MVP, no. Customers list = `customers` rows only.
  // Calls without customer_id don't contribute to any record's aggregates.
  for (const c of customers) {
    agg.set(c.id, {
      callCount: 0,
      lastContact: null,
      hasQuoteRequest: false,
      earliestQuoteAt: null,
      hasFutureBooking: false,
    })
  }
  for (const call of calls) {
    if (!call.customer_id) continue
    const a = agg.get(call.customer_id)
    if (!a) continue
    a.callCount += 1
    if (!a.lastContact || call.started_at > a.lastContact) a.lastContact = call.started_at
    if (call.outcome === 'quote_requested') {
      a.hasQuoteRequest = true
      if (!a.earliestQuoteAt || call.started_at < a.earliestQuoteAt) a.earliestQuoteAt = call.started_at
    }
  }
  for (const appt of appointments) {
    const a = agg.get(appt.customer_id)
    if (!a) continue
    if ((appt.status === 'booked' || appt.status === 'completed') && a.earliestQuoteAt && appt.scheduled_for > a.earliestQuoteAt) {
      a.hasFutureBooking = true
    }
  }

  // Compose, filter, sort.
  type Annotated = CustomerRow & Aggregate & { hasOpenFollowUp: boolean }
  let rows: Annotated[] = customers.map((c) => {
    const a = agg.get(c.id) ?? { callCount: 0, lastContact: null, hasQuoteRequest: false, earliestQuoteAt: null, hasFutureBooking: false }
    return { ...c, ...a, hasOpenFollowUp: a.hasQuoteRequest && !a.hasFutureBooking }
  })

  if (q) {
    const needle = q.toLowerCase()
    rows = rows.filter((r) =>
      (r.name?.toLowerCase().includes(needle) ?? false) ||
      (r.primary_phone?.toLowerCase().includes(needle) ?? false) ||
      (r.email?.toLowerCase().includes(needle) ?? false) ||
      (r.address?.toLowerCase().includes(needle) ?? false),
    )
  }
  if (openOnly) rows = rows.filter((r) => r.hasOpenFollowUp)

  rows.sort((a, b) => {
    switch (sort) {
      case 'name':
        return (a.name ?? '').localeCompare(b.name ?? '')
      case 'frequent':
        return b.callCount - a.callCount
      case 'recent':
      default: {
        const aTs = a.lastContact ? new Date(a.lastContact).getTime() : 0
        const bTs = b.lastContact ? new Date(b.lastContact).getTime() : 0
        return bTs - aTs
      }
    }
  })

  return (
    <Wrapper sort={sort} openOnly={openOnly} q={q}>
      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-300 bg-white px-6 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-900 dark:text-white">
            {customers.length === 0 ? 'No customers yet' : 'No matches'}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {customers.length === 0
              ? 'Customers appear here as the AI captures them on calls.'
              : 'Try a different filter or clear the search.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Name</th>
                <th className="px-4 py-2.5 text-left font-medium">Phone</th>
                <th className="px-4 py-2.5 text-left font-medium">Last contact</th>
                <th className="px-4 py-2.5 text-left font-medium">Calls</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">
                    <CustomerLink customerId={r.id} className="block w-full text-left hover:underline">
                      {r.name ?? <span className="text-zinc-500 dark:text-zinc-400">No name</span>}
                    </CustomerLink>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    <CustomerLink customerId={r.id} className="block w-full text-left">{formatPhone(r.primary_phone)}</CustomerLink>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                    <CustomerLink customerId={r.id} className="block w-full text-left">{formatRelativeDate(r.lastContact)}</CustomerLink>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                    <CustomerLink customerId={r.id} className="block w-full text-left">{r.callCount}</CustomerLink>
                  </td>
                  <td className="px-4 py-3">
                    <CustomerLink customerId={r.id} className="block w-full text-left">
                      {r.hasOpenFollowUp ? (
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                          Open follow-up
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400 dark:text-zinc-600">—</span>
                      )}
                    </CustomerLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        {rows.length} {rows.length === 1 ? 'customer' : 'customers'}
        {customers.length !== rows.length && ` (filtered from ${customers.length})`}
      </p>
    </Wrapper>
  )
}

function Wrapper({
  sort,
  openOnly,
  q,
  children,
}: {
  sort: SortKey
  openOnly: boolean
  q: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Customers</h1>
        <div className="flex flex-wrap items-center gap-2">
          <form method="get" className="flex items-center">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search name, phone, address…"
              className="w-64 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
            {sort && <input type="hidden" name="sort" value={sort} />}
            {openOnly && <input type="hidden" name="open" value="1" />}
          </form>
          <OpenFollowUpToggle active={openOnly} />
          <SortPicker current={sort} />
        </div>
      </div>
      {children}
    </div>
  )
}
