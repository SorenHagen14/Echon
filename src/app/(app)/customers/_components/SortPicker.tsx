'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { SORT_OPTIONS, type SortKey } from './sort-options'

export function SortPicker({ current }: { current: SortKey }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  return (
    <select
      value={current}
      disabled={pending}
      onChange={(e) => {
        const next = new URLSearchParams(searchParams.toString())
        next.set('sort', e.target.value)
        startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }))
      }}
      aria-label="Sort customers"
      className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {SORT_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}
