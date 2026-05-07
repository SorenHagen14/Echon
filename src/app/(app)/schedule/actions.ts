'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireWorkspace() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) throw new Error('Workspace not found')
  return { supabase, workspaceId: workspace.id as string }
}

// Single-form action driving both /schedule's Settings tab and Settings →
// Schedule. Both surfaces post the same field names so they share this
// handler.
export async function updateScheduleSettings(formData: FormData): Promise<void> {
  const weekStartRaw = formData.get('week_start')
  const timeRangeRaw = formData.get('schedule_time_range')

  const week_start =
    weekStartRaw === 'mon' ? 'mon' :
    weekStartRaw === 'sat' ? 'sat' : 'sun'
  const schedule_time_range = timeRangeRaw === 'full' ? 'full' : 'business'

  const { supabase, workspaceId } = await requireWorkspace()
  const { error } = await supabase
    .from('workspace_settings')
    .update({ week_start, schedule_time_range })
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(`Schedule settings update failed: ${error.message}`)

  revalidatePath('/schedule')
  revalidatePath('/settings')
}
