'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

// Click handler that opens the call detail modal by adding `?call=<id>` to
// the current URL. Implemented as a <button> so it can sit inside row-level
// Links without nesting <a>. Closes any other modal (customer profile) by
// removing those params, so only one modal is ever open at a time.
export function CallLink({
  callId,
  className,
  children,
}: {
  callId: string
  className?: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function onClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const next = new URLSearchParams(searchParams.toString())
    next.delete('customer')
    next.delete('case')
    next.set('call', callId)
    router.push(`${pathname}?${next.toString()}`, { scroll: false })
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  )
}
