'use client'

import { useActionState, useState } from 'react'
import { updateServices, type ServicesResult } from '../services-actions'
import type { ServiceOption } from '@/app/onboarding/_constants'
import type { ServiceRow } from './services-shape'

type Props = {
  initial: ServiceRow[]
  catalog: readonly ServiceOption[]
  businessTypeLabel: string | null
}

const inputCls =
  'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white'

export function ServicesSection({ initial, catalog, businessTypeLabel }: Props) {
  const [services, setServices] = useState<ServiceRow[]>(initial)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [state, formAction, pending] = useActionState<ServicesResult | null, FormData>(
    updateServices,
    null,
  )

  const usedKeys = new Set(services.map((s) => s.key))
  const catalogRemaining = catalog.filter((c) => !usedKeys.has(c.key))

  function addFromCatalog(opt: ServiceOption) {
    setServices((prev) => [
      ...prev,
      { key: opt.key, label: opt.label, book_directly: true, pricing_note: '' },
    ])
  }

  function addCustom() {
    const label = newLabel.trim()
    if (!label) return
    const baseKey = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'custom'
    let key = baseKey
    let n = 2
    while (services.some((s) => s.key === key)) {
      key = `${baseKey}_${n++}`
    }
    setServices((prev) => [
      ...prev,
      { key, label, book_directly: true, pricing_note: '' },
    ])
    setNewLabel('')
    setAdding(false)
  }

  function update(index: number, patch: Partial<ServiceRow>) {
    setServices((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function remove(index: number) {
    setServices((prev) => prev.filter((_, i) => i !== index))
  }

  function move(index: number, dir: -1 | 1) {
    setServices((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="services_json" value={JSON.stringify(services)} />

      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Your services</h3>
          {businessTypeLabel && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{businessTypeLabel}</span>
          )}
        </div>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          The agent will only book or quote what's listed here. Toggle <em>Book directly</em> off
          for services that always require a quote first.
        </p>

        {services.length === 0 && (
          <p className="mb-4 rounded-md border border-dashed border-zinc-300 px-3 py-4 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No services yet. Add one from the catalog or a custom service below.
          </p>
        )}

        <ul className="space-y-2">
          {services.map((s, i) => (
            <li
              key={`${s.key}-${i}`}
              className="rounded-md border border-zinc-200 px-3 py-3 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col">
                  <button
                    type="button"
                    aria-label="Move up"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="text-xs text-zinc-500 hover:text-zinc-900 disabled:opacity-30 dark:hover:text-white"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    onClick={() => move(i, 1)}
                    disabled={i === services.length - 1}
                    className="text-xs text-zinc-500 hover:text-zinc-900 disabled:opacity-30 dark:hover:text-white"
                  >
                    ▼
                  </button>
                </div>
                <input
                  type="text"
                  value={s.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  maxLength={100}
                  className={`flex-1 ${inputCls}`}
                />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                >
                  Remove
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 pl-9">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={s.book_directly}
                    onChange={(e) => update(i, { book_directly: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Book directly
                </label>
                <input
                  type="text"
                  value={s.pricing_note}
                  onChange={(e) => update(i, { pricing_note: e.target.value })}
                  maxLength={300}
                  placeholder="Pricing note (optional) — e.g. '$89 diagnostic, applied to repair'"
                  className={`flex-1 ${inputCls}`}
                />
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-3">
          {catalogRemaining.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Add from catalog
              </p>
              <div className="flex flex-wrap gap-2">
                {catalogRemaining.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => addFromCatalog(opt)}
                    className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    + {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {adding ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustom()
                  }
                }}
                placeholder="Service name"
                maxLength={100}
                autoFocus
                className={`flex-1 ${inputCls}`}
              />
              <button
                type="button"
                onClick={addCustom}
                className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setAdding(false); setNewLabel('') }}
                className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="text-xs font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
            >
              + Add custom service
            </button>
          )}
        </div>
      </div>

      {state && state.ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          Saved and synced to Vapi.
        </div>
      )}
      {state && !state.ok && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <p className="font-semibold">{state.savedToDb ? 'Partial save' : 'Save failed'}</p>
          <p className="mt-0.5 text-xs">{state.reason}</p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

