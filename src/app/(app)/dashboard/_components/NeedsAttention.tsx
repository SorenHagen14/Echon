import { createClient } from '@/lib/supabase/server'
import { resolveAttention } from '../actions'
import { CustomerLink } from '@/app/_components/customer-profile/CustomerLink'
import { CallLink } from '@/app/_components/calls/CallLink'

type CallRow = {
  id: string
  started_at: string
  outcome: string
  caller_phone: string | null
  flagged_for_review: boolean
  customer: { id: string; name: string | null } | null
}

type Reason = {
  key: 'flagged' | 'escalated' | 'repeat' | 'quote'
  label: string                            // pill copy
  description: string                      // sentence shown on the row
  className: string
  // sort priority — lower is more urgent (renders first when ties on time)
  priority: number
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
  if (!e164) return 'Unknown caller'
  const digits = e164.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return e164
}

const REASON_PILL_BASE = 'inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium'

export async function NeedsAttention({ workspaceId }: { workspaceId: string }) {
  const supabase = await createClient()

  // 14-day window: most "needs attention" items decay fast, but a flagged or
  // escalated call from a few days ago can still be unactioned.
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const { data, error } = await supabase
    .from('calls')
    .select('id, started_at, outcome, caller_phone, flagged_for_review, customer:customers(id, name)')
    .eq('workspace_id', workspaceId)
    .is('attention_resolved_at', null)
    .gte('started_at', fourteenDaysAgo)
    .order('started_at', { ascending: false })

  if (error) {
    return (
      <Section title="Needs attention">
        <p className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t load — {error.message}
        </p>
      </Section>
    )
  }

  const calls = (data ?? []) as unknown as CallRow[]

  // Repeat-caller set: phones with 2+ calls in the last 7 days.
  const recentPhoneCounts = new Map<string, number>()
  for (const c of calls) {
    if (!c.caller_phone) continue
    if (c.started_at < sevenDaysAgo) continue
    recentPhoneCounts.set(c.caller_phone, (recentPhoneCounts.get(c.caller_phone) ?? 0) + 1)
  }

  // Annotate each call with the most-urgent reason it qualifies (if any).
  const reasonFor = (c: CallRow): Reason | null => {
    if (c.flagged_for_review) {
      return {
        key: 'flagged',
        label: 'Flagged',
        description: 'Manually flagged for review.',
        className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
        priority: 0,
      }
    }
    if (c.outcome === 'escalated') {
      return {
        key: 'escalated',
        label: 'Escalated',
        description: 'AI escalated to a human — confirm it was handled.',
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
        priority: 1,
      }
    }
    const repeatCount = c.caller_phone ? recentPhoneCounts.get(c.caller_phone) ?? 0 : 0
    if (repeatCount >= 2) {
      return {
        key: 'repeat',
        label: `Repeat caller · ${repeatCount}×`,
        description: `Called ${repeatCount} times in the last 7 days — likely needs a human.`,
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
        priority: 2,
      }
    }
    if (c.outcome === 'quote_requested') {
      return {
        key: 'quote',
        label: 'Quote requested',
        description: 'Customer wants a quote — callback needed.',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
        priority: 3,
      }
    }
    return null
  }

  type Annotated = { call: CallRow; reason: Reason }
  const annotated: Annotated[] = []
  for (const call of calls) {
    const reason = reasonFor(call)
    if (reason) annotated.push({ call, reason })
  }

  // Dedupe by caller_phone so one customer with 3 calls doesn't fill the
  // list. Keep the most-urgent reason; tiebreak by recency (calls already
  // sorted desc by started_at, so first-seen = most recent).
  const byPhone = new Map<string, Annotated>()
  for (const a of annotated) {
    const key = a.call.caller_phone ?? `__unknown_${a.call.id}`
    const existing = byPhone.get(key)
    if (!existing || a.reason.priority < existing.reason.priority) {
      byPhone.set(key, a)
    }
  }

  const ranked = Array.from(byPhone.values())
    .sort((x, y) => {
      if (x.reason.priority !== y.reason.priority) return x.reason.priority - y.reason.priority
      return new Date(y.call.started_at).getTime() - new Date(x.call.started_at).getTime()
    })
    .slice(0, 5)

  if (ranked.length === 0) {
    return (
      <Section title="Needs attention">
        <div className="rounded-md border border-dashed border-zinc-300 bg-white px-6 py-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nothing needs your attention right now.
          </p>
        </div>
      </Section>
    )
  }

  return (
    <Section title="Needs attention">
      <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {ranked.map(({ call, reason }) => {
          const name = call.customer?.name ?? formatPhone(call.caller_phone)
          return (
            <li key={call.id} className="flex items-start gap-3 px-4 py-3 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {call.customer?.id ? (
                    <CustomerLink
                      customerId={call.customer.id}
                      className="truncate text-left font-medium text-zinc-900 hover:underline dark:text-white"
                    >
                      {name}
                    </CustomerLink>
                  ) : (
                    <span className="truncate font-medium text-zinc-900 dark:text-white">{name}</span>
                  )}
                  <span className={`${REASON_PILL_BASE} ${reason.className}`}>{reason.label}</span>
                </div>
                <CallLink callId={call.id} className="block w-full text-left">
                  <p className="mt-0.5 truncate text-xs text-zinc-600 dark:text-zinc-400">{reason.description}</p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">{formatRelativeTime(call.started_at)}</p>
                </CallLink>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <CallLink
                  callId={call.id}
                  className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Review
                </CallLink>
                <form action={resolveAttention}>
                  <input type="hidden" name="callId" value={call.id} />
                  <button
                    type="submit"
                    aria-label="Mark resolved"
                    title="Mark resolved — this call has already been handled"
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-zinc-900 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Resolved
                  </button>
                </form>
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
