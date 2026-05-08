'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
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

const ModeSchema = z.enum(['messages_only', 'escalate', 'live_transfer'])

// E.164 — '+' followed by 7-15 digits. We do NOT auto-format; the UI
// hint asks for "+15125551234" form. Empty entries are dropped before
// parsing.
const OncallSchema = z.object({
  phone: z.string().regex(/^\+\d{7,15}$/, 'Use E.164 (e.g. +15125551234)'),
  label: z.string().trim().max(40).optional().or(z.literal('')),
})

export type AfterHoursResult =
  | { ok: true }
  | { ok: false; reason: string; savedToDb: boolean }

export async function updateAfterHours(
  _prev: AfterHoursResult | null,
  formData: FormData,
): Promise<AfterHoursResult> {
  const { supabase, workspaceId } = await requireWorkspace()

  const mode = ModeSchema.safeParse(formData.get('mode'))
  if (!mode.success) {
    return { ok: false, reason: 'Pick an after-hours mode.', savedToDb: false }
  }

  const oncallRaw = formData.get('oncall_json')
  let oncallList: { phone: string; label: string }[] = []
  if (typeof oncallRaw === 'string' && oncallRaw.trim().length > 0) {
    let parsedRaw: unknown
    try {
      parsedRaw = JSON.parse(oncallRaw)
    } catch {
      return { ok: false, reason: 'Bad on-call list format.', savedToDb: false }
    }
    if (!Array.isArray(parsedRaw)) {
      return { ok: false, reason: 'On-call list must be an array.', savedToDb: false }
    }
    const cleaned = (parsedRaw as Array<Record<string, unknown>>)
      .map((r) => ({ phone: String(r.phone ?? '').trim(), label: String(r.label ?? '').trim() }))
      .filter((r) => r.phone.length > 0)
    for (const r of cleaned) {
      const v = OncallSchema.safeParse(r)
      if (!v.success) {
        return {
          ok: false,
          reason: `${r.phone || '(blank)'}: ${v.error.issues[0]?.message ?? 'invalid'}`,
          savedToDb: false,
        }
      }
    }
    // De-dupe by phone.
    const seen = new Set<string>()
    oncallList = cleaned.filter((r) => {
      if (seen.has(r.phone)) return false
      seen.add(r.phone)
      return true
    }).slice(0, 10)
  }

  // escalate / live_transfer require at least one number — otherwise
  // the chosen mode silently degrades to messages_only on Vapi's side.
  if (mode.data !== 'messages_only' && oncallList.length === 0) {
    return {
      ok: false,
      reason: 'Add at least one on-call number, or switch to "Take a message".',
      savedToDb: false,
    }
  }

  const { error } = await supabase
    .from('agent_configs')
    .update({
      after_hours_mode: mode.data,
      oncall_numbers: oncallList,
    })
    .eq('workspace_id', workspaceId)
  if (error) {
    return { ok: false, reason: `Save failed: ${error.message}`, savedToDb: false }
  }

  try {
    await syncVapiAssistant(supabase, workspaceId, { throwOnError: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    revalidatePath('/settings/after-hours')
    return { ok: false, reason: `Saved to Echon, but Vapi sync failed: ${msg}`, savedToDb: true }
  }

  await supabase
    .from('agent_configs')
    .update({ vapi_synced_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)

  revalidatePath('/settings/after-hours')
  return { ok: true }
}
