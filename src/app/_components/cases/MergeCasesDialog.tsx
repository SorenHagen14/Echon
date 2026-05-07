'use client'

import { useEffect, useState, useTransition } from 'react'
import { loadMergeCandidates, mergeCases } from './actions'

type Candidate = {
  callId: string
  caseId: string
  caseTitle: string | null
  caseStatus: 'open' | 'closed'
  startedAt: string
  outcome: string
  serviceRequested: string | null
  callCount: number
  appointmentCount: number
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

// "Merge with another case" — shows recent calls for the same customer
// (each annotated with which case it lives in). Clicking a call merges that
// call's case into the current one. Asks for confirmation before applying.
export function MergeCasesDialog({
  caseId,
}: {
  caseId: string
}) {
  const [open, setOpen] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [picked, setPicked] = useState<Candidate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, startLoad] = useTransition()
  const [submitting, startSubmit] = useTransition()

  useEffect(() => {
    if (!open) return
    setCandidates(null)
    setPicked(null)
    setError(null)
    startLoad(() => {
      loadMergeCandidates(caseId)
        .then(setCandidates)
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
    })
  }, [open, caseId])

  function close() {
    if (submitting) return
    setOpen(false)
  }

  async function onConfirm() {
    if (!picked) return
    const fd = new FormData()
    fd.set('intoCaseId', caseId)
    fd.set('fromCaseId', picked.caseId)
    startSubmit(async () => {
      try {
        await mergeCases(fd)
        setOpen(false)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Merge failed')
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Merge cases
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Merge with another case"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 px-4 py-6 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Merge with another case</h2>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Browse this customer&apos;s recent calls. Pick one — its case&apos;s calls and appointments
                  will be moved into this case, and that case will be deleted.
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

            {loading || !candidates ? (
              <p className="px-1 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">Loading recent calls…</p>
            ) : candidates.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No other cases for this customer.
              </p>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {candidates.map((c) => {
                  const isPicked = picked?.caseId === c.caseId
                  return (
                    <li key={c.callId}>
                      <button
                        type="button"
                        onClick={() => setPicked(c)}
                        className={`flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                          isPicked
                            ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/40'
                            : 'border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-zinc-900 dark:text-white">
                            {c.caseTitle ?? c.serviceRequested ?? 'Untitled case'}
                            <span className={`ml-2 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                              c.caseStatus === 'open'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                            }`}>{c.caseStatus}</span>
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            Call · {formatDate(c.startedAt)} · {c.outcome}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
                            Case has {c.callCount} {c.callCount === 1 ? 'call' : 'calls'} · {c.appointmentCount} {c.appointmentCount === 1 ? 'appointment' : 'appointments'}
                          </p>
                        </div>
                      </button>
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
                disabled={submitting || !picked}
                className="rounded-md border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:border-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {submitting ? 'Merging…' : picked ? 'Merge into this case' : 'Pick a case'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
