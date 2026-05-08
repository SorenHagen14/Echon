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

const TONES = ['friendly', 'professional', 'direct'] as const
const SPEAKING_RATES = ['slow', 'normal', 'fast'] as const
function pickEnum<T extends readonly string[]>(values: T, raw: FormDataEntryValue | null): T[number] | null {
  if (typeof raw !== 'string') return null
  return (values as readonly string[]).includes(raw) ? (raw as T[number]) : null
}

function nullableString(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  return t ? t : null
}

function clampNumber(raw: FormDataEntryValue | null, min: number, max: number, fallback: number): number {
  const n = typeof raw === 'string' ? Number(raw) : NaN
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

function parseEndCallPhrases(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== 'string') return []
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 60)
    .slice(0, 20)
}

export type VoicePersonaResult =
  | { ok: true }
  | { ok: false; reason: string; savedToDb: boolean }

// Saves Settings → Receptionist → Voice & persona, then syncs the assistant
// to Vapi. One action covers Basics + Advanced. Returns a result object so
// the form can show the user whether the DB save and Vapi sync each
// succeeded or failed independently.
export async function updateVoicePersona(_prev: VoicePersonaResult | null, formData: FormData): Promise<VoicePersonaResult> {
  const { supabase, workspaceId } = await requireWorkspace()

  // Read current row so we can implement one-step undo on system prompt:
  // when the new prompt differs from the existing one, we copy the old
  // value to `previous_custom_system_prompt` first.
  const { data: existing } = await supabase
    .from('agent_configs')
    .select('use_custom_system_prompt, custom_system_prompt')
    .eq('workspace_id', workspaceId)
    .single()

  const useCustom = formData.get('use_custom_system_prompt') === 'true'
  const newCustom = nullableString(formData.get('custom_system_prompt'))
  const oldCustom = (existing?.custom_system_prompt as string | null) ?? null

  // Custom prompt empty trap: if the user toggled on but didn't actually
  // type a prompt, refuse the save. Otherwise they'd freeze a snapshot of
  // the auto-generated prompt and silently detach from business config.
  if (useCustom && (!newCustom || newCustom.length < 50)) {
    return {
      ok: false,
      reason: 'Custom prompt is required when "use custom" is on, and needs to be at least 50 characters. Either turn the toggle off or paste/write a prompt.',
      savedToDb: false,
    }
  }

  // End-call phrases must include at least one entry; otherwise the agent
  // never auto-hangs up. Fall back to sensible defaults if the user nuked
  // the textarea.
  const phrases = parseEndCallPhrases(formData.get('end_call_phrases'))
  const endCallPhrases = phrases.length > 0
    ? phrases
    : ['goodbye', 'bye', 'have a good day', 'thank you bye']

  const updates: Record<string, unknown> = {
    agent_name: nullableString(formData.get('agent_name')) ?? 'Riley',
    greeting: nullableString(formData.get('greeting')),
    tone: pickEnum(TONES, formData.get('tone')) ?? 'friendly',
    // speaking_rate is dead code in the prompt now (voice_speed handles
    // both UX and TTS) — kept in DB for backward compat. Always derive
    // from voice_speed via a hidden input so the column doesn't drift.
    speaking_rate: pickEnum(SPEAKING_RATES, formData.get('speaking_rate')) ?? 'normal',
    recording_enabled: formData.get('recording_enabled') === 'true',

    // model_tier is intentionally NOT updated here — picker is hidden and
    // everyone runs on Haiku ('fast'). Re-introduce when tier-gating lands.
    temperature: clampNumber(formData.get('temperature'), 0, 1, 0.7),
    max_tokens: Math.round(clampNumber(formData.get('max_tokens'), 50, 1000, 250)),
    end_call_phrases: endCallPhrases,
    interruption_threshold_sec: clampNumber(formData.get('interruption_threshold_sec'), 0.1, 3.0, 0.5),
    max_call_duration_sec: Math.round(clampNumber(formData.get('max_call_duration_sec'), 180, 900, 480)),
    silence_timeout_sec: Math.round(clampNumber(formData.get('silence_timeout_sec'), 3, 10, 5)),
    voice_speed: clampNumber(formData.get('voice_speed'), 0.25, 2.0, 1.0),

    use_custom_system_prompt: useCustom,
    custom_system_prompt: useCustom ? newCustom : oldCustom,
  }

  // Snapshot the old prompt to the undo slot only when it actually changed
  // and the user is keeping custom mode on. Avoids overwriting a useful
  // undo target with a no-op save.
  if (useCustom && newCustom !== oldCustom && oldCustom != null) {
    updates.previous_custom_system_prompt = oldCustom
  }

  const { error } = await supabase
    .from('agent_configs')
    .update(updates)
    .eq('workspace_id', workspaceId)
  if (error) {
    return { ok: false, reason: `Save failed: ${error.message}`, savedToDb: false }
  }

  // DB save succeeded; now push to Vapi. If this fails, the user needs to
  // know — their Echon settings drifted from what's actually live on calls.
  try {
    await syncVapiAssistant(supabase, workspaceId, { throwOnError: true })
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    console.error('[updateVoicePersona] Vapi sync failed', reason)
    revalidatePath('/settings/voice')
    return {
      ok: false,
      reason: `Saved to Echon, but Vapi sync failed: ${reason}`,
      savedToDb: true,
    }
  }

  // Drift indicator: stamp the time we successfully pushed to Vapi.
  // The UI compares this against agent_configs.updated_at to decide
  // whether to show "your changes aren't on Vapi yet."
  await supabase
    .from('agent_configs')
    .update({ vapi_synced_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)

  revalidatePath('/settings/voice')
  return { ok: true }
}

// One-step undo: swap `custom_system_prompt` ↔ `previous_custom_system_prompt`.
// Invoked from a separate form so the row's other state isn't disturbed.
export async function revertSystemPrompt(): Promise<void> {
  const { supabase, workspaceId } = await requireWorkspace()

  const { data: row } = await supabase
    .from('agent_configs')
    .select('custom_system_prompt, previous_custom_system_prompt')
    .eq('workspace_id', workspaceId)
    .single()
  if (!row) throw new Error('Workspace agent config not found')

  const current = (row.custom_system_prompt as string | null) ?? null
  const previous = (row.previous_custom_system_prompt as string | null) ?? null
  if (previous == null) throw new Error('No previous system prompt to revert to')

  await supabase
    .from('agent_configs')
    .update({
      custom_system_prompt: previous,
      previous_custom_system_prompt: current,
    })
    .eq('workspace_id', workspaceId)

  try {
    await syncVapiAssistant(supabase, workspaceId, { throwOnError: true })
  } catch (e) {
    console.warn('[revertSystemPrompt] Vapi sync failed', e)
  }

  revalidatePath('/settings/voice')
}
