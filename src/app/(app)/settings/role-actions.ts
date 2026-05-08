'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { syncVapiAssistant } from '@/app/onboarding/_voice-sync'

export type RoleResult =
  | { ok: true }
  | { ok: false; reason: string; savedToDb: boolean }

const VALID_CAPABILITIES = ['booking', 'messaging', 'faq'] as const
type Capability = typeof VALID_CAPABILITIES[number]

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

export async function updateAgentRole(
  _prev: RoleResult | null,
  formData: FormData,
): Promise<RoleResult> {
  const { supabase, workspaceId } = await requireWorkspace()

  const capabilities: Capability[] = VALID_CAPABILITIES.filter(
    (cap) => formData.get(`cap_${cap}`) === 'on',
  )

  if (capabilities.length === 0) {
    return {
      ok: false,
      reason: 'Select at least one capability — otherwise the agent won\'t know what to do on a call.',
      savedToDb: false,
    }
  }

  const { error } = await supabase
    .from('agent_configs')
    .update({ agent_capabilities: capabilities })
    .eq('workspace_id', workspaceId)

  if (error) {
    return { ok: false, reason: `Save failed: ${error.message}`, savedToDb: false }
  }

  try {
    await syncVapiAssistant(supabase, workspaceId, { throwOnError: true })
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    revalidatePath('/settings/role')
    return {
      ok: false,
      reason: `Saved to Echon, but Vapi sync failed: ${reason}`,
      savedToDb: true,
    }
  }

  await supabase
    .from('agent_configs')
    .update({ vapi_synced_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)

  revalidatePath('/settings/role')
  return { ok: true }
}
