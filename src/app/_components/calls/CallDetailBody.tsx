import Link from 'next/link'
import { CustomerLink } from '@/app/_components/customer-profile/CustomerLink'
import { toggleFlagForReview } from '@/app/(app)/calls/[id]/actions'
import type { CallDetail, TranscriptTurn } from './types'

const OUTCOME_BADGES: Record<string, { label: string; className: string }> = {
  booked: { label: 'Booked', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  quote_requested: { label: 'Quote requested', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  escalated: { label: 'Escalated', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  no_action: { label: 'No action', className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' },
  hung_up: { label: 'Hung up', className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  processing: { label: 'Processing', className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
}

function formatPhone(e164: string | null): string {
  if (!e164) return 'Unknown'
  const digits = e164.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  return e164
}
function formatDuration(sec: number | null): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function summaryLines(s: string | null): string[] {
  if (!s) return []
  return s.split('\n').map((l) => l.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean)
}

// The shared body — used by both the standalone /calls/[id] page and the
// modal. No layout chrome (no back link, no max-width container) so the
// caller can wrap it however it likes.
export function CallDetailBody({ call }: { call: CallDetail }) {
  const badge = OUTCOME_BADGES[call.outcome] ?? OUTCOME_BADGES.processing
  const displayName = call.customer?.name ?? formatPhone(call.caller_phone)
  const phone = call.customer?.primary_phone ?? call.caller_phone
  const bullets = summaryLines(call.summary)

  return (
    <div>
      {/* Header */}
      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
              {call.customer?.id ? (
                <CustomerLink customerId={call.customer.id} className="text-left hover:underline">
                  {displayName}
                </CustomerLink>
              ) : displayName}
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              {formatPhone(phone)}
              {call.customer?.email && <> · {call.customer.email}</>}
            </p>
          </div>
          <span className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-medium ${badge.className}`}>{badge.label}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          <span>{formatDateTime(call.started_at)}</span>
          <span>Duration {formatDuration(call.duration_sec)}</span>
          <span>Direction {call.direction}</span>
          {call.callee_phone && <span>To {formatPhone(call.callee_phone)}</span>}
          {call.case_id && (
            <Link
              href={`/cases/${call.case_id}`}
              className="text-indigo-600 hover:underline dark:text-indigo-400"
            >
              View case →
            </Link>
          )}
        </div>

        {/* Recording slot */}
        <div className="mt-4 rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          {call.recording_url
            ? <audio controls className="w-full" src={call.recording_url} />
            : 'Recording not yet available — appears here after the post-call processing job runs.'}
        </div>
      </div>

      {/* Body — transcript on the left, summary + fields + actions on the right */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Transcript</h2>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            {Array.isArray(call.transcript) && call.transcript.length > 0 ? (
              <ol className="space-y-3">
                {call.transcript.filter((t) => t.role !== 'system').map((turn: TranscriptTurn, i: number) => (
                  <li key={i} className="text-sm">
                    <div className="mb-0.5 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {turn.role === 'assistant' ? (call.agent_name ?? 'Bot') : turn.role === 'user' ? 'Caller' : turn.role}
                    </div>
                    <p className="text-zinc-800 dark:text-zinc-200">{turn.message}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Transcript not yet available. Live transcripts populate after each call ends.
              </p>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Summary</h2>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              {bullets.length > 0 ? (
                <ul className="space-y-1.5 text-zinc-700 dark:text-zinc-300">
                  {bullets.map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-zinc-400 dark:text-zinc-600" aria-hidden="true">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-zinc-500 dark:text-zinc-400">No summary yet.</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Extracted fields</h2>
            <dl className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white text-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              <Field label="Service requested" value={call.service_requested} />
              <Field label="System type" value={call.system_type} />
              <Field label="Service address" value={call.service_address ?? call.customer?.address ?? null} />
              <Field label="Urgency" value={call.urgency} />
              {call.appointment && (
                <Field
                  label="Appointment"
                  value={`${formatDateTime(call.appointment.scheduled_for)}${call.appointment.service_type ? ` · ${call.appointment.service_type}` : ''}`}
                />
              )}
            </dl>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Actions</h2>
            <form action={toggleFlagForReview}>
              <input type="hidden" name="callId" value={call.id} />
              <input type="hidden" name="nextValue" value={String(!call.flagged_for_review)} />
              <button
                type="submit"
                className={`w-full rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  call.flagged_for_review
                    ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/40'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                {call.flagged_for_review ? 'Unflag (currently flagged)' : 'Flag for review'}
              </button>
            </form>
            {call.flagged_for_review && call.flag_reason && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Reason: {call.flag_reason}</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-right text-zinc-900 dark:text-zinc-100">
        {value ?? <span className="text-zinc-400 dark:text-zinc-600">—</span>}
      </dd>
    </div>
  )
}
