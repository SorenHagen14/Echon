'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

// Click handler that opens the customer profile modal by setting
// `?customer=<id>` on the current URL. Implemented as a <button> so it
// can sit inside row-level Links without nesting <a> tags.
export function CustomerLink({
  customerId,
  className,
  children,
}: {
  customerId: string
  className?: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function onClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    // Open one modal at a time: drop the call modal if open.
    const next = new URLSearchParams(searchParams.toString())
    next.delete('call')
    next.delete('case')
    next.set('customer', customerId)
    router.push(`${pathname}?${next.toString()}`, { scroll: false })
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  )
}
