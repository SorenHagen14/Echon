'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { loadCustomerProfile } from './actions'
import { CustomerProfileBody } from './CustomerProfileBody'
import type { CustomerProfileData } from './data'

// URL-driven customer profile overlay. Watches `?customer=<id>` on the
// current route and renders the profile body when set. Mounted once per
// authed layout. Refresh keeps it open; back button + Escape + X + click
// outside all close it by removing the query param via router.push (so the
// browser history reflects open/closed state).
export function CustomerProfileModal() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const customerId = searchParams.get('customer')

  const [data, setData] = useState<CustomerProfileData | null>(null)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const close = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('customer')
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  // Fetch the profile whenever the URL points at a different customer.
  useEffect(() => {
    if (!customerId) {
      setData(null)
      setLoadedFor(null)
      return
    }
    if (loadedFor === customerId) return
    let cancelled = false
    startTransition(() => {})
    loadCustomerProfile(customerId).then((result) => {
      if (cancelled) return
      setData(result)
      setLoadedFor(customerId)
    })
    return () => {
      cancelled = true
    }
  }, [customerId, loadedFor])

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    if (!customerId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [customerId, close])

  if (!customerId) return null

  const isStale = loadedFor !== customerId
  const notFound = !isStale && data === null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Customer profile"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/60 px-4 py-8 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="relative w-full max-w-5xl rounded-xl border border-zinc-200 bg-zinc-50 p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close customer profile"
          className="absolute right-3 top-3 rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {isStale ? (
          <div className="px-2 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Loading customer…
          </div>
        ) : notFound ? (
          <div className="px-2 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Customer not found.
          </div>
        ) : data ? (
          <CustomerProfileBody data={data} />
        ) : null}
      </div>
    </div>
  )
}
