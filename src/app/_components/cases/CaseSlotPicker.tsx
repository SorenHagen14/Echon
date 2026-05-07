'use client'

import { useRef } from 'react'
import { assignCaseSlot } from './actions'
import { SLOT_META, type CaseSlot, type EligibleOperator } from './types'

// One role slot on a case. Renders the eligible operators only — eligibility
// is owned by Settings → Team. Empty value = unassigned.
export function CaseSlotPicker({
  caseId,
  slot,
  currentOperatorId,
  operators,
}: {
  caseId: string
  slot: CaseSlot
  currentOperatorId: string | null
  operators: EligibleOperator[]
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const meta = SLOT_META[slot]
  const eligible = operators.filter((o) => o[meta.eligibilityField])
  const current = eligible.find((o) => o.id === currentOperatorId)

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {meta.label}
      </div>
      {eligible.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          No one marked eligible.{' '}
          <a href="/settings/team" className="underline hover:text-zinc-900 dark:hover:text-white">
            Add in Settings
          </a>
          .
        </p>
      ) : (
        <form ref={formRef} action={assignCaseSlot} className="flex items-center gap-2">
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="slot" value={slot} />
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 shrink-0 rounded-full border border-zinc-200 dark:border-zinc-700"
            style={{ backgroundColor: current?.color ?? 'transparent' }}
          />
          <select
            name="operatorId"
            defaultValue={currentOperatorId ?? ''}
            onChange={() => formRef.current?.requestSubmit()}
            className="flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="">Unassigned</option>
            {eligible.map((op) => (
              <option key={op.id} value={op.id}>{op.name}</option>
            ))}
          </select>
        </form>
      )}
    </div>
  )
}
