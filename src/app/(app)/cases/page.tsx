import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CustomerLink } from '@/app/_components/customer-profile/CustomerLink'

type CaseRow = {
  id: string
  status: 'open' | 'closed'
  title: string | null
  opened_at: string
  closed_at: string | null
  customer: { id: string; name: string | null } | null
  cs_rep: { id: string; name: string; color: string } | null
  technician: { id: string; name: string; color: string } | null
  manager: { id: string; name: string; color: string } | null
}

const STATUS_BADGES: Record<'open' | 'closed', string> = {
  open:   'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  closed: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const params = await searchParams
  const filter = params.status === 'all' ? 'all' : 'open'
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

  let query = supabase
    .from('cases')
    .select(`
      id, status, title, opened_at, closed_at,
      customer:customers(id, name),
      cs_rep:operators!cases_cs_rep_id_fkey(id, name, color),
      technician:operators!cases_technician_id_fkey(id, name, color),
      manager:operators!cases_manager_id_fkey(id, name, color)
    `)
    .eq('workspace_id', workspace.id)
    .order('opened_at', { ascending: false })
  if (filter === 'open') query = query.eq('status', 'open')

  const { data, error } = await query
  let rows = ((data ?? []) as unknown as CaseRow[])

  if (q) {
    const needle = q.toLowerCase()
    rows = rows.filter((r) =>
      (r.title?.toLowerCase().includes(needle) ?? false) ||
      (r.customer?.name?.toLowerCase().includes(needle) ?? false),
    )
  }

  // Linked-call/appointment counts per case — small N, one round trip each.
  const caseIds = rows.map((r) => r.id)
  const callsByCase = new Map<string, number>()
  const apptsByCase = new Map<string, number>()
  if (caseIds.length > 0) {
    const [{ data: callCounts }, { data: apptCounts }] = await Promise.all([
      supabase.from('calls').select('case_id').in('case_id', caseIds),
      supabase.from('appointments').select('case_id').in('case_id', caseIds),
    ])
    for (const r of (callCounts ?? []) as { case_id: string }[]) {
      callsByCase.set(r.case_id, (callsByCase.get(r.case_id) ?? 0) + 1)
    }
    for (const r of (apptCounts ?? []) as { case_id: string }[]) {
      apptsByCase.set(r.case_id, (apptsByCase.get(r.case_id) ?? 0) + 1)
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Cases</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">What needs to be fixed.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form method="get" className="flex items-center gap-2">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search customer or title…"
              className="w-64 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
            {filter === 'all' && <input type="hidden" name="status" value="all" />}
          </form>
          <div className="inline-flex overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
            <Link
              href={q ? `/cases?q=${encodeURIComponent(q)}` : '/cases'}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === 'open'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              Open
            </Link>
            <Link
              href={q ? `/cases?status=all&q=${encodeURIComponent(q)}` : '/cases?status=all'}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              All
            </Link>
          </div>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">Couldn&apos;t load cases — {error.message}</p>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-300 bg-white px-6 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-900 dark:text-white">
            {filter === 'open' ? 'No open cases.' : 'No cases yet.'}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Cases appear here when calls come in. Each case groups every call and
            appointment for one customer issue.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {rows.map((r) => {
            const calls = callsByCase.get(r.id) ?? 0
            const appts = apptsByCase.get(r.id) ?? 0
            return (
              <li key={r.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[r.status]}`}>
                    {r.status === 'open' ? 'Open' : 'Closed'}
                  </span>
                  <Link href={`/cases/${r.id}`} className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-zinc-900 dark:text-white">{r.title ?? 'Untitled case'}</span>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <SlotDot operator={r.cs_rep} title="Customer service" />
                    <SlotDot operator={r.technician} title="Technician" />
                    <SlotDot operator={r.manager} title="Manager" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-3 text-xs text-zinc-500 dark:text-zinc-400">
                  {r.customer?.id ? (
                    <CustomerLink customerId={r.customer.id} className="text-left hover:underline">
                      {r.customer.name ?? 'Unnamed customer'}
                    </CustomerLink>
                  ) : (
                    <span>{r.customer?.name ?? 'Unnamed customer'}</span>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>Opened {formatRelative(r.opened_at)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{calls} {calls === 1 ? 'call' : 'calls'} · {appts} {appts === 1 ? 'appointment' : 'appointments'}</span>
                  {r.closed_at && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Closed {formatRelative(r.closed_at)}</span>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        {rows.length} {rows.length === 1 ? 'case' : 'cases'}
      </p>
    </div>
  )
}

function SlotDot({ operator, title }: { operator: { name: string; color: string } | null; title: string }) {
  return (
    <span
      title={`${title}: ${operator?.name ?? 'unassigned'}`}
      aria-label={`${title}: ${operator?.name ?? 'unassigned'}`}
      className="inline-block h-3 w-3 rounded-full border border-zinc-200 dark:border-zinc-700"
      style={{ backgroundColor: operator?.color ?? 'transparent' }}
    />
  )
}
