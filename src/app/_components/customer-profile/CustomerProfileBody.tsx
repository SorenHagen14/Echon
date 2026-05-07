import { addEquipment, removeEquipment, updateNotes } from '@/app/(app)/customers/[id]/actions'
import { CallLink } from '@/app/_components/calls/CallLink'
import type {
  AppointmentEntry,
  CallEntry,
  CustomerProfileData,
} from './data'

const OUTCOME_LABEL: Record<string, string> = {
  booked: 'Booked',
  quote_requested: 'Quote requested',
  escalated: 'Escalated',
  no_action: 'No action',
  hung_up: 'Hung up',
  failed: 'Failed',
  processing: 'Processing',
}

const STATUS_LABEL: Record<string, string> = {
  booked: 'Booked',
  rescheduled: 'Rescheduled',
  completed: 'Completed',
  canceled: 'Canceled',
  no_show: 'No-show',
}

function formatPhone(e164: string | null): string {
  if (!e164) return ''
  const digits = e164.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return e164
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDate(iso: string | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// DD/MM/YYYY for transcript headings on the customer profile timeline.
function formatDateDMY(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function summaryLines(s: string | null): string[] {
  if (!s) return []
  return s.split('\n').map((l) => l.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean)
}

export function CustomerProfileBody({ data }: { data: CustomerProfileData }) {
  const { customer, timeline, callCount, apptCount } = data

  return (
    <div>
      {/* Header */}
      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
          {customer.name ?? 'Unnamed customer'}
        </h1>
        <dl className="mt-3 grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-2">
          <Field label="Phone" value={formatPhone(customer.primary_phone)} />
          {customer.secondary_phone && (
            <Field label="Secondary phone" value={formatPhone(customer.secondary_phone)} />
          )}
          <Field label="Email" value={customer.email} />
          <Field label="Address" value={customer.address} />
          <Field label="Customer since" value={formatDateTime(customer.created_at)} />
          <Field label="History" value={`${callCount} ${callCount === 1 ? 'call' : 'calls'} · ${apptCount} ${apptCount === 1 ? 'appointment' : 'appointments'}`} />
        </dl>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left — timeline */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            History
          </h2>
          {timeline.length === 0 ? (
            <div className="rounded-md border border-dashed border-zinc-300 bg-white px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No calls or appointments yet for this customer.
              </p>
            </div>
          ) : (
            <ol className="space-y-3">
              {timeline.map((entry) => (
                <li
                  key={`${entry.kind}-${entry.id}`}
                  className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {entry.kind === 'call' ? <CallTimelineCard entry={entry} /> : <AppointmentTimelineCard entry={entry} />}
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Right — notes + equipment */}
        <aside className="space-y-6">
          {/* Notes */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Notes
            </h2>
            <form action={updateNotes} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <input type="hidden" name="customerId" value={customer.id} />
              <textarea
                name="notes"
                defaultValue={customer.notes ?? ''}
                rows={5}
                placeholder="Gate codes, dog warnings, equipment quirks, customer preferences…"
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

          {/* Equipment */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Equipment
            </h2>
            <div className="space-y-2">
              {customer.equipment.length === 0 ? (
                <p className="rounded-md border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  No equipment recorded yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {customer.equipment.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-2 rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zinc-900 dark:text-white">{item.type}</p>
                        {(item.brand || item.model) && (
                          <p className="text-xs text-zinc-600 dark:text-zinc-400">
                            {[item.brand, item.model].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {item.install_date && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-500">Installed {formatDate(item.install_date)}</p>
                        )}
                        {item.notes && <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{item.notes}</p>}
                      </div>
                      <form action={removeEquipment}>
                        <input type="hidden" name="customerId" value={customer.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <button
                          type="submit"
                          aria-label="Remove equipment item"
                          title="Remove"
                          className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                        >
                          ×
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              <details className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  + Add equipment
                </summary>
                <form action={addEquipment} className="space-y-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
                  <input type="hidden" name="customerId" value={customer.id} />
                  <Input name="type" label="Type" placeholder="AC unit · Water heater · Panel · etc." required />
                  <div className="grid grid-cols-2 gap-2">
                    <Input name="brand" label="Brand" placeholder="Carrier, Rheem…" />
                    <Input name="model" label="Model" placeholder="Model #" />
                  </div>
                  <Input name="install_date" label="Install date" type="date" />
                  <Input name="notes" label="Notes" placeholder="Refrigerant, capacity, etc." />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    >
                      Add
                    </button>
                  </div>
                </form>
              </details>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-32 shrink-0 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-sm text-zinc-800 dark:text-zinc-200">
        {value ?? <span className="text-zinc-400 dark:text-zinc-600">—</span>}
      </dd>
    </div>
  )
}

function Input({
  name, label, placeholder, required, type = 'text',
}: {
  name: string
  label: string
  placeholder?: string
  required?: boolean
  type?: string
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-xs text-zinc-600 dark:text-zinc-400">{label}{required && ' *'}</span>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        required={required}
        className="block w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600"
      />
    </label>
  )
}

function CallTimelineCard({ entry }: { entry: CallEntry }) {
  const bullets = summaryLines(entry.summary)
  const turns = entry.transcript ?? []
  return (
    <div>
      <CallLink callId={entry.id} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Call · {OUTCOME_LABEL[entry.outcome] ?? entry.outcome}
            </p>
            {entry.service_requested && (
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{entry.service_requested}</p>
            )}
            {bullets.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                {bullets.slice(0, 2).map((b, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-600">•</span>
                    <span className="truncate">{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">{formatDateTime(entry.at)}</span>
        </div>
      </CallLink>
      <details className="group mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
        <summary className="flex cursor-pointer items-center justify-between gap-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200">
          <span className="flex items-center gap-1.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="transition-transform group-open:rotate-90"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            Transcript
          </span>
          <span className="font-normal text-zinc-500 dark:text-zinc-500">{formatDateDMY(entry.at)}</span>
        </summary>
        <div className="mt-2 rounded-md bg-zinc-50 p-3 dark:bg-zinc-950/40">
          {turns.length === 0 ? (
            <p className="text-xs italic text-zinc-500 dark:text-zinc-500">
              Transcript not yet available for this call.
            </p>
          ) : (
            <ul className="space-y-2 text-xs">
              {turns.map((turn, i) => {
                const isAssistant = turn.role === 'assistant'
                return (
                  <li key={i} className="flex gap-2">
                    <span
                      className={`shrink-0 font-medium ${
                        isAssistant
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {isAssistant ? 'Agent' : turn.role === 'user' ? 'Caller' : turn.role}:
                    </span>
                    <span className="text-zinc-700 dark:text-zinc-300">{turn.message}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </details>
    </div>
  )
}

function AppointmentTimelineCard({ entry }: { entry: AppointmentEntry }) {
  const head = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Appointment · {STATUS_LABEL[entry.status] ?? entry.status}
        </p>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{entry.service_type}</p>
        {entry.service_address && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{entry.service_address}</p>
        )}
      </div>
      <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">{formatDateTime(entry.at)}</span>
    </div>
  )
  if (entry.call_id) {
    return <CallLink callId={entry.call_id} className="block w-full text-left">{head}</CallLink>
  }
  return head
}
