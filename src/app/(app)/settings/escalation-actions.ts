'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { syncVapiAssistant } from '@/app/onboarding/_voice-sync'

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

export type EscalationResult =
  | { ok: true }
  | { ok: false; reason: string; savedToDb: boolean }

function parseLines(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== 'string') return []
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 200)
    .slice(0, 25)
}

// Saves escalation_triggers + escalation_non_triggers, then syncs to Vapi
// so the new rules land in the system prompt. The form posts JSON-encoded
// arrays from the pill UI plus a textarea for free-text additions.
export async function updateEscalationRules(
  _prev: EscalationResult | null,
  formData: FormData,
): Promise<EscalationResult> {
  const { supabase, workspaceId } = await requireWorkspace()

  // The pill UI serializes the active triggers as a JSON string in a hidden
  // input, plus a textarea of newline-separated custom additions.
  let triggers: string[] = []
  let nonTriggers: string[] = []
  try {
    triggers = JSON.parse(String(formData.get('triggers') ?? '[]'))
    nonTriggers = JSON.parse(String(formData.get('non_triggers') ?? '[]'))
  } catch {
    return { ok: false, reason: 'Bad form payload — please refresh and try again.', savedToDb: false }
  }
  triggers = [...triggers, ...parseLines(formData.get('triggers_custom'))]
  nonTriggers = [...nonTriggers, ...parseLines(formData.get('non_triggers_custom'))]

  // De-dupe (case-insensitive).
  const dedupe = (arr: string[]) => {
    const seen = new Set<string>()
    return arr.filter((s) => {
      const k = s.toLowerCase().trim()
      if (!k || seen.has(k)) return false
      seen.add(k)
      return true
    })
  }
  triggers = dedupe(triggers)
  nonTriggers = dedupe(nonTriggers)

  if (triggers.length === 0) {
    return {
      ok: false,
      reason: 'You need at least one escalation trigger. Otherwise the agent will never escalate.',
      savedToDb: false,
    }
  }

  const { error } = await supabase
    .from('agent_configs')
    .update({
      escalation_triggers: triggers,
      escalation_non_triggers: nonTriggers,
    })
    .eq('workspace_id', workspaceId)
  if (error) {
    return { ok: false, reason: `Save failed: ${error.message}`, savedToDb: false }
  }

  try {
    await syncVapiAssistant(supabase, workspaceId, { throwOnError: true })
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    revalidatePath('/settings/escalation')
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

  revalidatePath('/settings/escalation')
  return { ok: true }
}

// Default trigger / non-trigger pills moved to _components/escalation-defaults.ts
// because plain constants can't be exported from a 'use server' file —
// they'd be serialized as RPC handles instead of arrays.
