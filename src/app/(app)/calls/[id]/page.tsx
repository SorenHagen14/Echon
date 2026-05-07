import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CallDetailBody } from '@/app/_components/calls/CallDetailBody'
import { fetchCallDetail } from '@/app/_components/calls/data'

// Standalone call detail page. Same body the call modal uses; this page
// exists so call URLs are deep-linkable / shareable / refreshable. The
// `?from=customer` flow on the back link is preserved.
export default async function CallDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const call = await fetchCallDetail(id)
  if (!call) notFound()

  return (
    <div>
      <div className="mb-4">
        {from === 'customer' && call.customer ? (
          <Link
            href={`/customers/${call.customer.id}`}
            className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            <span aria-hidden="true">←</span> Back to {call.customer.name ?? 'customer'}
          </Link>
        ) : call.case_id ? (
          <Link
            href={`/cases/${call.case_id}`}
            className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            <span aria-hidden="true">←</span> Back to case
          </Link>
        ) : (
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            <span aria-hidden="true">←</span> Back to dashboard
          </Link>
        )}
      </div>
      <CallDetailBody call={call} />
    </div>
  )
}
