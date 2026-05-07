'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

// Click handler that opens the case detail modal by setting `?case=<id>` on
// the current URL. Mirrors CustomerLink and CallLink — implemented as a
// <button> so it can sit inside row-level Links without nesting <a> tags.
// Drops the customer + call modal params so only one modal is ever open.
export function CaseLink({
  caseId,
  className,
  children,
  title,
}: {
  caseId: string
  className?: string
  children: React.ReactNode
  title?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function onClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const next = new URLSearchParams(searchParams.toString())
    next.delete('customer')
    next.delete('call')
    next.set('case', caseId)
    router.push(`${pathname}?${next.toString()}`, { scroll: false })
  }

  return (
    <button type="button" onClick={onClick} className={className} title={title}>
      {children}
    </button>
  )
}
