'use client'

import { useEffect, useState, useTransition } from 'react'
import { confirmAutoAssign, recommendAutoAssign } from './actions'
import { SLOT_META, type AutoAssignReport, type CaseSlot } from './types'

// "Auto-assign ✨" — fetches deterministic recommendations on open, lets the
// user toggle individual slots off, then applies on confirm. Refresh of the
// underlying page happens via revalidatePath in confirmAutoAssign.
export function AutoAssignDialog({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false)
  const [report, setReport] = useState<AutoAssignReport | null>(null)
  const [skipped, setSkipped] = useState<Record<CaseSlot, boolean>>({ cs_rep: false, technician: false, manager: false })
  const [error, setError] = useState<string | null>(null)
  const [loadingReport, startReport] = useTransition()
  const [submitting, startSubmit] = useTransition()

  useEffect(() => {
    if (!open) return
    setReport(null)
    setError(null)
    setSkipped({ cs_rep: false, technician: false, manager: false })
    startReport(() => {
      recommendAutoAssign(caseId)
        .then((r) => setReport(r))
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load recommendations'))
    })
  }, [open, caseId])

  function close() {
    if (submitting) return
    setOpen(false)
  }

  async function onConfirm() {
    if (!report) return
    const fd = new FormData()
    fd.set('caseId', caseId)
    for (const r of report.results) {
      if (r.status === 'recommended' && !skipped[r.slot]) {
        fd.set(`slot:${r.slot}`, r.operatorId)
      }
    }
    startSubmit(async () => {
      try {
        await confirmAutoAssign(fd)
        setOpen(false)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Apply failed')
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-900 transition-colors hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
      >
        <span aria-hidden="true">✨</span> Auto-assign
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Auto-assign recommendations"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 px-4 py-6 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Auto-assign recommendations</h2>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Picked by role eligibility, scheduling availability, and per-role priority.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                ×
              </button>
            </div>

            {error && (
              <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            )}

            {loadingReport || !report ? (
              <p className="px-1 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Computing recommendations…
              </p>
            ) : (
              <ul className="space-y-2">
                {report.results.map((r) => {
                  const meta = SLOT_META[r.slot]
                  return (
                    <li key={r.slot} className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{meta.label}</p>
                          {r.status === 'recommended' ? (
                            <p className="mt-0.5 flex items-center gap-2 text-sm text-zinc-900 dark:text-white">
                              <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full border border-zinc-200 dark:border-zinc-700" style={{ backgroundColor: r.operatorColor }} />
                              {r.operatorName} <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">· priority {r.priority}</span>
                            </p>
                          ) : r.status === 'kept' ? (
                            <p className="mt-0.5 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                              <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full border border-zinc-200 dark:border-zinc-700" style={{ backgroundColor: r.operatorColor }} />
                              {r.operatorName} <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">· already assigned</span>
                            </p>
                          ) : (
                            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">— left empty</p>
                          )}
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">{r.reason}</p>
                        </div>
                        {r.status === 'recommended' && (
                          <label className="inline-flex shrink-0 items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                            <input
                              type="checkbox"
                              checked={!skipped[r.slot]}
                              onChange={(e) => setSkipped((s) => ({ ...s, [r.slot]: !e.currentTarget.checked }))}
                              className="h-3.5 w-3.5"
                            />
                            Apply
                          </label>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={submitting}
                className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={submitting || loadingReport || !report || !report.results.some((r) => r.status === 'recommended' && !skipped[r.slot])}
                className="rounded-md border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:border-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {submitting ? 'Applying…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
