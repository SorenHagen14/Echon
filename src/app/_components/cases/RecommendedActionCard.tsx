'use client'

import { useTransition } from 'react'
import { generateCaseRecommendedAction } from './actions'

function summaryLines(s: string | null): string[] {
  if (!s) return []
  return s.split('\n').map((l) => l.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean)
}

// Recommended action lives at the case level — one brief covering every call
// in the case. Click the sparkle to (re)generate from the case's transcripts.
export function RecommendedActionCard({
  caseId,
  recommendedAction,
}: {
  caseId: string
  recommendedAction: string | null
}) {
  const [pending, startTransition] = useTransition()
  const bullets = summaryLines(recommendedAction)

  function regenerate() {
    startTransition(async () => {
      try {
        await generateCaseRecommendedAction(caseId)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to generate'
        alert(msg)
      }
    })
  }

  return (
    <section className="rounded-lg border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900/50 dark:bg-indigo-950/30">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-900 dark:text-indigo-300">
          Recommended action
        </h2>
        {bullets.length > 0 && (
          <button
            type="button"
            onClick={regenerate}
            disabled={pending}
            title="Regenerate from the case's transcripts"
            className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-900 transition-colors hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:bg-indigo-900/40"
          >
            <span aria-hidden="true">✨</span> {pending ? 'Generating…' : 'Regenerate'}
          </button>
        )}
      </div>

      {bullets.length > 0 ? (
        <>
          <p className="mb-3 text-xs text-indigo-800/80 dark:text-indigo-300/80">
            Brief for the rep handling the callback — generated from every call in this case.
          </p>
          <ul className="space-y-1.5 text-sm text-indigo-950 dark:text-indigo-100">
            {bullets.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-indigo-500 dark:text-indigo-400" aria-hidden="true">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-indigo-900/80 dark:text-indigo-300/80">
            Need a brief before calling this customer back? Generate one from every call in this case.
          </p>
          <button
            type="button"
            onClick={regenerate}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-xs font-medium text-indigo-900 transition-colors hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:bg-indigo-900/40"
          >
            <span aria-hidden="true">✨</span> {pending ? 'Generating…' : 'Generate'}
          </button>
        </div>
      )}
    </section>
  )
}
