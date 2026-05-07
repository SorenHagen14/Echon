import { CustomerLink } from '@/app/_components/customer-profile/CustomerLink'
import { CallLink } from '@/app/_components/calls/CallLink'
import { AutoAssignDialog } from './AutoAssignDialog'
import { MergeCasesDialog } from './MergeCasesDialog'
import { CaseSlotPicker } from './CaseSlotPicker'
import { setCaseStatus } from './actions'
import type { CaseDetail } from './types'

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

const STATUS_BADGES: Record<'open' | 'closed', string> = {
  open: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  closed: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
}

const OUTCOME_LABEL: Record<string, string> = {
  booked: 'Booked', quote_requested: 'Quote requested', escalated: 'Escalated',
  no_action: 'No action', hung_up: 'Hung up', failed: 'Failed', processing: 'Processing',
}

const APPT_STATUS_LABEL: Record<string, string> = {
  booked: 'Booked', rescheduled: 'Rescheduled', completed: 'Completed', canceled: 'Canceled', no_show: 'No-show',
}

// The "case section" — top of /calls/[id]. Shows the case status, the three
// role slots (with manual dropdowns + an Auto-assign dialog), the merge
// button, and a list of every call/appointment in this case so the user can
// jump between them.
export function CaseSection({
  detail,
  focusedCallId,
  hideItemsList = false,
}: {
  detail: CaseDetail
  focusedCallId: string
  hideItemsList?: boolean
}) {
  const { case: c, customer, calls, appointments, operators } = detail
  const closing = c.status === 'open' ? 'closed' : 'open'

  return (
    <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Case</p>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {customer?.id ? (
              <CustomerLink customerId={customer.id} className="text-left hover:underline">
                {customer.name ?? 'Unnamed customer'}
              </CustomerLink>
            ) : (
              customer?.name ?? 'Unnamed customer'
            )}
            {c.title && <span className="ml-2 text-base font-normal text-zinc-600 dark:text-zinc-400">— {c.title}</span>}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Opened {formatDateTime(c.opened_at)}
            {' · '}{calls.length} {calls.length === 1 ? 'call' : 'calls'}
            {' · '}{appointments.length} {appointments.length === 1 ? 'appointment' : 'appointments'}
            {c.closed_at && <> · closed {formatDateTime(c.closed_at)}</>}
          </p>
        </div>
        <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGES[c.status]}`}>
          {c.status === 'open' ? 'Open' : 'Closed'}
        </span>
      </div>

      {/* Role slots */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <CaseSlotPicker caseId={c.id} slot="cs_rep"     currentOperatorId={c.cs_rep_id}     operators={operators} />
        <CaseSlotPicker caseId={c.id} slot="technician" currentOperatorId={c.technician_id} operators={operators} />
        <CaseSlotPicker caseId={c.id} slot="manager"    currentOperatorId={c.manager_id}    operators={operators} />
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <AutoAssignDialog caseId={c.id} />
        <MergeCasesDialog caseId={c.id} />
        <form action={setCaseStatus}>
          <input type="hidden" name="caseId" value={c.id} />
          <input type="hidden" name="status" value={closing} />
          <button
            type="submit"
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {c.status === 'open' ? 'Mark closed' : 'Reopen'}
          </button>
        </form>
      </div>

      {/* Other items in this case — calls + appointments. The currently-
          focused call is rendered without a link. Suppressed on /cases/[id]
          where the page already renders dedicated lists below. */}
      {!hideItemsList && (calls.length > 1 || appointments.length > 0) && (
        <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Items in this case</p>
          <ul className="space-y-1.5 text-sm">
            {calls.map((call) => {
              const isFocused = call.id === focusedCallId
              const label = `Call · ${formatDateTime(call.started_at)} · ${OUTCOME_LABEL[call.outcome] ?? call.outcome}${call.service_requested ? ` · ${call.service_requested}` : ''}`
              return (
                <li key={call.id} className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                  <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-600">•</span>
                  {isFocused ? (
                    <span className="font-medium text-zinc-900 dark:text-white">{label} <span className="text-xs font-normal text-zinc-500">(viewing)</span></span>
                  ) : (
                    <CallLink callId={call.id} className="text-left hover:underline">{label}</CallLink>
                  )}
                </li>
              )
            })}
            {appointments.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-600">•</span>
                <span>Appointment · {formatDateTime(a.scheduled_for)} · {APPT_STATUS_LABEL[a.status] ?? a.status}{a.service_type ? ` · ${a.service_type}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
