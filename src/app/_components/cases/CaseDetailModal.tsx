'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { loadCaseDetail } from './loadCaseDetail'
import { CaseDetailBody } from './CaseDetailBody'
import type { CaseDetail } from './types'

// URL-driven case detail overlay. Mirrors the customer + call modals.
// Watches `?case=<id>` and renders the case body when set.
export function CaseDetailModal() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const caseId = searchParams.get('case')

  const [data, setData] = useState<CaseDetail | null>(null)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  const close = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('case')
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  useEffect(() => {
    if (!caseId) {
      setData(null)
      setLoadedFor(null)
      return
    }
    if (loadedFor === caseId) return
    let cancelled = false
    loadCaseDetail(caseId).then((result) => {
      if (cancelled) return
      setData(result)
      setLoadedFor(caseId)
    })
    return () => { cancelled = true }
  }, [caseId, loadedFor])

  useEffect(() => {
    if (!caseId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [caseId, close])

  if (!caseId) return null

  const isStale = loadedFor !== caseId
  const notFound = !isStale && data === null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Case detail"
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
          aria-label="Close case detail"
          className="absolute right-3 top-3 rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {isStale ? (
          <div className="px-2 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">Loading case…</div>
        ) : notFound ? (
          <div className="px-2 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">Case not found.</div>
        ) : data ? (
          <CaseDetailBody detail={data} />
        ) : null}
      </div>
    </div>
  )
}
