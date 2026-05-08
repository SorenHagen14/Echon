'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
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

const PrefsSchema = z.object({
  emergency_escalation: z.boolean(),
  quote_request:        z.boolean(),
  flagged_for_review:   z.boolean(),
  ai_failed:            z.boolean(),
  contact_email:        z.string().trim().email().or(z.literal('')).nullable().optional(),
})

export type NotificationsResult =
  | { ok: true }
  | { ok: false; reason: string }

// Notification prefs are pure DB state — no Vapi sync needed; Vapi
// doesn't know or care which alerts the operator wants.
export async function updateNotificationPrefs(
  _prev: NotificationsResult | null,
  formData: FormData,
): Promise<NotificationsResult> {
  const { supabase, workspaceId } = await requireWorkspace()

  const parsed = PrefsSchema.safeParse({
    emergency_escalation: formData.get('emergency_escalation') === 'on',
    quote_request:        formData.get('quote_request')        === 'on',
    flagged_for_review:   formData.get('flagged_for_review')   === 'on',
    ai_failed:            formData.get('ai_failed')            === 'on',
    contact_email:        (formData.get('contact_email') as string | null) ?? '',
  })
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.issues[0]?.message ?? 'Invalid form.' }
  }

  const next = {
    emergency_escalation: parsed.data.emergency_escalation,
    quote_request:        parsed.data.quote_request,
    flagged_for_review:   parsed.data.flagged_for_review,
    ai_failed:            parsed.data.ai_failed,
    // Empty string normalizes to null so the dispatcher falls back to
    // the workspace owner's auth email.
    contact_email:
      typeof parsed.data.contact_email === 'string' && parsed.data.contact_email.length > 0
        ? parsed.data.contact_email
        : null,
  }

  const { error } = await supabase
    .from('agent_configs')
    .update({ notification_prefs: next })
    .eq('workspace_id', workspaceId)
  if (error) return { ok: false, reason: `Save failed: ${error.message}` }

  revalidatePath('/settings/notifications')
  return { ok: true }
}
