'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Dev-only helper: resets the signed-in user's onboarding cursor and sends
// them back to Step 1. Hard-gated on NODE_ENV so it cannot run in production.
//
// Per-step answer wipes (services, hours, voice config, etc.) land in Phase 5
// once those columns exist on agent_configs. For now this is a cursor reset.
export async function resetOnboarding(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('resetOnboarding is disabled in production')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) throw new Error('Workspace not found')

  await supabase
    .from('workspace_settings')
    .update({ onboarding_completed: false })
    .eq('workspace_id', workspace.id)

  await supabase
    .from('workspaces')
    .update({ onboarding_step: 1 })
    .eq('id', workspace.id)

  revalidatePath('/', 'layout')
  redirect('/onboarding')
}
