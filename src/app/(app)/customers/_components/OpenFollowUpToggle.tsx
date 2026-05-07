'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

export function OpenFollowUpToggle({ active }: { active: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const next = new URLSearchParams(searchParams.toString())
        if (active) next.delete('open')
        else next.set('open', '1')
        startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }))
      }}
      className={`rounded-md border px-2.5 py-1.5 text-sm transition-colors disabled:opacity-50 ${
        active
          ? 'border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/40'
          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
      }`}
    >
      {active ? '✓ Open follow-up' : 'Open follow-up'}
    </button>
  )
}
