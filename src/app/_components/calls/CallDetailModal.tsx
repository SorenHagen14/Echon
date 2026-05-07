'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { loadCallDetail } from './actions'
import { CallDetailBody } from './CallDetailBody'
import type { CallDetail } from './types'

// URL-driven call detail overlay. Mirrors the customer profile modal.
// Watches `?call=<id>` and renders the call body when set. Mounted once
// per authed layout. Refresh keeps it open; back/forward + Escape + X +
// click outside close it.
export function CallDetailModal() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const callId = searchParams.get('call')

  const [data, setData] = useState<CallDetail | null>(null)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  const close = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('call')
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  useEffect(() => {
    if (!callId) {
      setData(null)
      setLoadedFor(null)
      return
    }
    if (loadedFor === callId) return
    let cancelled = false
    loadCallDetail(callId).then((result) => {
      if (cancelled) return
      setData(result)
      setLoadedFor(callId)
    })
    return () => { cancelled = true }
  }, [callId, loadedFor])

  useEffect(() => {
    if (!callId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [callId, close])

  if (!callId) return null

  const isStale = loadedFor !== callId
  const notFound = !isStale && data === null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Call detail"
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
          aria-label="Close call detail"
          className="absolute right-3 top-3 rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {isStale ? (
          <div className="px-2 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">Loading call…</div>
        ) : notFound ? (
          <div className="px-2 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">Call not found.</div>
        ) : data ? (
          <CallDetailBody call={data} />
        ) : null}
      </div>
    </div>
  )
}
