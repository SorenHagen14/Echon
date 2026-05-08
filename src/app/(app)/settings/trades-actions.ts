'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { syncVapiAssistant } from '@/app/onboarding/_voice-sync'

export type TradesResult =
  | { ok: true }
  | { ok: false; reason: string }

const PRIMARY_TRADES = [
  'hvac', 'plumbing', 'roofing', 'electrical',
  'deck_fence', 'landscaping', 'general_contractor', 'other',
] as const

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

// Updates primary `business_type` + free-text `business_type_other` (when
// 'other' is chosen) + `additional_trades[]`. Re-syncs Vapi so the
// system prompt's trade context updates.
export async function updateTrades(
  _prev: TradesResult | null,
  formData: FormData,
): Promise<TradesResult> {
  const { supabase, workspaceId } = await requireWorkspace()

  const primaryRaw = String(formData.get('business_type') ?? '')
  const primary = (PRIMARY_TRADES as readonly string[]).includes(primaryRaw) ? primaryRaw : null
  if (!primary) return { ok: false, reason: 'Pick a primary trade.' }

  const otherText = String(formData.get('business_type_other') ?? '').trim() || null
  if (primary === 'other' && !otherText) {
    return { ok: false, reason: 'When primary is "Other", describe what kind of business this is.' }
  }

  // Additional trades come in as a comma-separated hidden input from the
  // multi-select pill UI. Filter to the same enum and dedupe against
  // primary.
  const additionalRaw = String(formData.get('additional_trades') ?? '')
  const additional = Array.from(new Set(
    additionalRaw.split(',').map((s) => s.trim()).filter(Boolean),
  )).filter((s) => (PRIMARY_TRADES as readonly string[]).includes(s) && s !== primary && s !== 'other')

  const { error } = await supabase
    .from('workspaces')
    .update({
      business_type: primary,
      business_type_other: otherText,
      additional_trades: additional,
    })
    .eq('id', workspaceId)
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

  revalidatePath('/settings/trades')
  revalidatePath('/settings/voice')
  return { ok: true }
}
