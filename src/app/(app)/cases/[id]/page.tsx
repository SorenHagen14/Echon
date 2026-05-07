import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CaseDetailBody } from '@/app/_components/cases/CaseDetailBody'
import { fetchCaseDetail } from '@/app/_components/cases/data'

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) redirect('/login')

  const detail = await fetchCaseDetail(id, workspace.id)
  if (!detail) notFound()

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/cases"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
        >
          <span aria-hidden="true">←</span> Back to cases
        </Link>
      </div>

      <CaseDetailBody detail={detail} />
    </div>
  )
}
