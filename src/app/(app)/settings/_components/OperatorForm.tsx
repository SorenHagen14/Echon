'use client'

import { useState } from 'react'
import { createOperator, deleteOperator, updateOperator } from '../actions'
import type { Operator } from './TeamSection'

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#64748b',
]

const PRIORITY_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function OperatorForm({ operator }: { operator?: Operator }) {
  const isEdit = !!operator

  // Local state for the eligibility checkboxes — drives whether the matching
  // priority input renders. Server source of truth still wins after submit.
  const [isCs, setIsCs] = useState(operator?.is_cs_rep ?? false)
  const [isTech, setIsTech] = useState(operator?.is_technician ?? false)
  const [isMgr, setIsMgr] = useState(operator?.is_manager ?? false)

  return (
    <form action={isEdit ? updateOperator : createOperator} className="mt-3 space-y-4">
      {operator && <input type="hidden" name="id" value={operator.id} />}

      {/* Identity */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field name="name" label="Name" defaultValue={operator?.name} required placeholder="e.g. Mike Reyes" />
        <Field name="email" label="Email" type="email" defaultValue={operator?.email ?? ''} placeholder="mike@…" />
        <Field name="phone" label="Phone" type="tel" defaultValue={operator?.phone ?? ''} placeholder="+1 (555) 123-4567" />
      </div>

      {/* Color */}
      <div>
        <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Color</span>
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_COLORS.map((c, i) => (
            <label key={c} className="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={c}
                defaultChecked={operator ? operator.color === c : i === PRESET_COLORS.length - 1}
                className="peer sr-only"
              />
              <span
                aria-label={`Select color ${c}`}
                className="block h-7 w-7 rounded-full border border-zinc-200 ring-offset-2 ring-offset-white transition-shadow peer-checked:ring-2 peer-checked:ring-zinc-900 dark:border-zinc-700 dark:ring-offset-zinc-900 dark:peer-checked:ring-white"
                style={{ backgroundColor: c }}
              />
            </label>
          ))}
        </div>
      </div>

      {/* Eligibility — drives which case slots this person can be picked for */}
      <div>
        <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">
          Eligible for case slots
        </span>
        <div className="flex flex-wrap gap-4 text-sm text-zinc-700 dark:text-zinc-300">
          <CheckLabel
            name="is_cs_rep"
            label="Customer service"
            checked={isCs}
            onChange={setIsCs}
          />
          <CheckLabel
            name="is_technician"
            label="Technician"
            checked={isTech}
            onChange={setIsTech}
          />
          <CheckLabel
            name="is_manager"
            label="Manager"
            checked={isMgr}
            onChange={setIsMgr}
          />
        </div>
      </div>

      {/* Advanced — per-role priority. Only shown for the roles this person is
          eligible for; we still post hidden defaults for unchecked roles so
          updateOperator gets a complete payload. */}
      {(isCs || isTech || isMgr) && (
        <details className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
          <summary className="cursor-pointer text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Advanced — priority per role
          </summary>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            1–10. Higher wins when auto-assign picks between eligible operators
            who are both available.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {isCs && (
              <PriorityField name="priority_cs" label="Customer service" defaultValue={operator?.priority_cs ?? 5} />
            )}
            {isTech && (
              <PriorityField name="priority_tech" label="Technician" defaultValue={operator?.priority_tech ?? 5} />
            )}
            {isMgr && (
              <PriorityField name="priority_manager" label="Manager" defaultValue={operator?.priority_manager ?? 5} />
            )}
          </div>
        </details>
      )}

      <div className="flex items-center justify-end gap-2">
        {isEdit && (
          <button
            type="submit"
            formAction={deleteOperator}
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Remove
          </button>
        )}
        <button
          type="submit"
          className="rounded-md border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:border-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isEdit ? 'Save' : 'Add'}
        </button>
      </div>
    </form>
  )
}

function CheckLabel({
  name, label, checked, onChange,
}: { name: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2">
      {/* Hidden default lets the server action receive 'false' when unchecked */}
      <input type="hidden" name={name} value="false" />
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
        value="true"
        className="h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-700"
      />
      {label}
    </label>
  )
}

function PriorityField({ name, label, defaultValue }: { name: string; label: string; defaultValue: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">{label}</span>
      <select
        name={name}
        defaultValue={String(defaultValue)}
        className="block w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
      >
        {PRIORITY_VALUES.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    </label>
  )
}

function Field({
  name, label, defaultValue, placeholder, required, type = 'text',
}: {
  name: string
  label: string
  defaultValue?: string | null
  placeholder?: string
  required?: boolean
  type?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">{label}{required && ' *'}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        required={required}
        className="block w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600"
      />
    </label>
  )
}
