'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { WINDOW_OPTIONS, type WindowKey } from './window-options'

export function WindowPicker({ current }: { current: WindowKey }) {
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
        next.set('window', e.target.value)
        startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }))
      }}
      aria-label="Select time window"
      className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {WINDOW_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}
