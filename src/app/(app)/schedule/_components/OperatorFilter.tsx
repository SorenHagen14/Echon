'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export type FilterOperator = {
  id: string
  name: string
  color: string
}

// Pill row above the calendar. Drives `?tech=<id|unassigned>` (no value =
// "All", which is the default landing state).
export function OperatorFilter({
  operators,
  selected,
}: {
  operators: FilterOperator[]
  selected: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function pick(value: string | null) {
    const next = new URLSearchParams(searchParams.toString())
    if (value === null) next.delete('tech')
    else next.set('tech', value)
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Pill active={selected === null} onClick={() => pick(null)}>
        All
      </Pill>
      {operators.map((op) => (
        <Pill
          key={op.id}
          active={selected === op.id}
          onClick={() => pick(op.id)}
          swatch={op.color}
        >
          {op.name}
        </Pill>
      ))}
      <Pill active={selected === 'unassigned'} onClick={() => pick('unassigned')}>
        Unassigned
      </Pill>
    </div>
  )
}

function Pill({
  children,
  active,
  onClick,
  swatch,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  swatch?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
      }`}
    >
      {swatch && (
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: swatch }}
        />
      )}
      {children}
    </button>
  )
}
