'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchCaseDetail } from './data'
import type { CaseDetail } from './types'

export async function loadCaseDetail(caseId: string): Promise<CaseDetail | null> {
  if (!caseId) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) return null
  return fetchCaseDetail(caseId, workspace.id as string)
}
