'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { syncVapiAssistant } from '@/app/onboarding/_voice-sync'

export type OnCallEntry = { phone: string; label: string }
export type OnCallResult =
  | { ok: true }
  | { ok: false; reason: string }

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

// Loose E.164-ish normalizer. We only support US numbers in the MVP, so
// anything that boils down to 10 digits gets prefixed with +1.
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length === 12 && raw.trim().startsWith('+')) return `+${digits}`
  return null
}

// Saves the workspace's on-call numbers (currently a single primary, room
// for rotation later). Re-syncs Vapi so the `transfer_call` tool uses the
// new destination on the next call.
export async function updateOnCallNumbers(
  _prev: OnCallResult | null,
  formData: FormData,
): Promise<OnCallResult> {
  const { supabase, workspaceId } = await requireWorkspace()

  const phoneRaw = String(formData.get('primary_phone') ?? '').trim()
  const labelRaw = String(formData.get('primary_label') ?? '').trim() || 'Primary on-call'

  if (!phoneRaw) {
    // Empty submit = clear on-call. Useful for "no live transfer, escalate
    // to message-only".
    const { error } = await supabase
      .from('agent_configs')
      .update({ oncall_numbers: [] })
      .eq('workspace_id', workspaceId)
    if (error) return { ok: false, reason: `Save failed: ${error.message}` }
    try {
      await syncVapiAssistant(supabase, workspaceId, { throwOnError: true })
    } catch (e) {
      return { ok: false, reason: `Saved to Echon, but Vapi sync failed: ${e instanceof Error ? e.message : String(e)}` }
    }
    revalidatePath('/settings/on-call')
    return { ok: true }
  }

  const phone = normalizePhone(phoneRaw)
  if (!phone) {
    return { ok: false, reason: 'That doesn\'t look like a US phone number. Use 10 digits — e.g. (512) 555-0143.' }
  }

  const entries: OnCallEntry[] = [{ phone, label: labelRaw }]
  const { error } = await supabase
    .from('agent_configs')
    .update({ oncall_numbers: entries })
    .eq('workspace_id', workspaceId)
  if (error) return { ok: false, reason: `Save failed: ${error.message}` }

  try {
    await syncVapiAssistant(supabase, workspaceId, { throwOnError: true })
    await supabase
      .from('agent_configs')
      .update({ vapi_synced_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
  } catch (e) {
    return {
      ok: false,
      reason: `Saved to Echon, but Vapi sync failed: ${e instanceof Error ? e.message : String(e)}`,
    }
  }

  revalidatePath('/settings/on-call')
  revalidatePath('/settings/escalation')
  return { ok: true }
}
