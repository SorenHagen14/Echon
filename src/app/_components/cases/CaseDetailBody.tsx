import { CallLink } from '@/app/_components/calls/CallLink'
import { CaseSection } from './CaseSection'
import { RecommendedActionCard } from './RecommendedActionCard'
import { updateCaseNotes } from './actions'
import type { CaseDetail } from './types'

const OUTCOME_LABEL: Record<string, string> = {
  booked: 'Booked', quote_requested: 'Quote requested', escalated: 'Escalated',
  no_action: 'No action', hung_up: 'Hung up', failed: 'Failed', processing: 'Processing',
}

const APPT_STATUS_LABEL: Record<string, string> = {
  booked: 'Booked', rescheduled: 'Rescheduled', completed: 'Completed', canceled: 'Canceled', no_show: 'No-show',
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

// Shared body used by both /cases/[id] (full page) and the case detail modal.
// Renders the case header, linked calls, linked appointments, notes form, and
// the recommended-action card.
export function CaseDetailBody({ detail }: { detail: CaseDetail }) {
  return (
    <div>
      <CaseSection detail={detail} focusedCallId="" hideItemsList />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Calls
            </h2>
            {detail.calls.length === 0 ? (
              <p className="rounded-md border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                No calls linked to this case yet.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                {detail.calls.map((c) => (
                  <li key={c.id}>
                    <CallLink
                      callId={c.id}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-zinc-900 dark:text-white">
                          {c.service_requested ?? 'Call'} <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">· {OUTCOME_LABEL[c.outcome] ?? c.outcome}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{formatDateTime(c.started_at)}</p>
                      </div>
                      <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-600">View →</span>
                    </CallLink>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Appointments
            </h2>
            {detail.appointments.length === 0 ? (
              <p className="rounded-md border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                No appointments on this case yet.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                {detail.appointments.map((a) => (
                  <li key={a.id} className="px-4 py-3 text-sm">
                    <p className="font-medium text-zinc-900 dark:text-white">
                      {a.service_type ?? 'Appointment'} <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">· {APPT_STATUS_LABEL[a.status] ?? a.status}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{formatDateTime(a.scheduled_for)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Notes
            </h2>
            <form action={updateCaseNotes} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <input type="hidden" name="caseId" value={detail.case.id} />
              <textarea
                name="notes"
                defaultValue={detail.case.notes ?? ''}
                rows={5}
                placeholder="Internal notes for this case — what's been tried, what to watch for, what the rep said when…"
                className="block w-full resize-y rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  Save notes
                </button>
              </div>
            </form>
          </section>
        </div>

        <aside className="space-y-6">
          <RecommendedActionCard
            caseId={detail.case.id}
            recommendedAction={detail.case.recommended_action}
          />
        </aside>
      </div>
    </div>
  )
}
