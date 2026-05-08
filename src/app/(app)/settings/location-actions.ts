'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { syncVapiAssistant } from '@/app/onboarding/_voice-sync'

export type LocationResult =
  | { ok: true }
  | { ok: false; reason: string }

const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
])

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

// Saves business state + service area description. State drives the
// auto-recording-disclosure logic in the system prompt — when the
// business is in a two-party-consent state, the agent asks for consent
// at the top of every call.
export async function updateLocation(
  _prev: LocationResult | null,
  formData: FormData,
): Promise<LocationResult> {
  const { supabase, workspaceId } = await requireWorkspace()

  const stateRaw = String(formData.get('business_state') ?? '').trim().toUpperCase()
  const state = stateRaw && US_STATES.has(stateRaw) ? stateRaw : null
  const address = String(formData.get('business_address') ?? '').trim() || null

  const { error } = await supabase
    .from('agent_configs')
    .update({
      business_state: state,
      business_address: address,
    })
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

  revalidatePath('/settings/location')
  revalidatePath('/settings/voice')
  return { ok: true }
}
