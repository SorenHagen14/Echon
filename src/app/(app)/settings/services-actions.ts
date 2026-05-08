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

const ServiceSchema = z.object({
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(100),
  book_directly: z.boolean(),
  pricing_note: z.string().trim().max(300),
})

const ServicesSchema = z.array(ServiceSchema).max(50)

export type ServicesResult =
  | { ok: true }
  | { ok: false; reason: string; savedToDb: boolean }

export async function updateServices(
  _prev: ServicesResult | null,
  formData: FormData,
): Promise<ServicesResult> {
  const { supabase, workspaceId } = await requireWorkspace()

  const raw = formData.get('services_json')
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'Missing form data.', savedToDb: false }
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'Invalid services data.', savedToDb: false }
  }

  const parsed = ServicesSchema.safeParse(parsedJson)
  if (!parsed.success) {
    return { ok: false, reason: 'Services format is invalid.', savedToDb: false }
  }

  const seen = new Set<string>()
  const dedupedAndSlugged = parsed.data.map((s) => {
    let key = s.key.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'custom'
    let n = 2
    let candidate = key
    while (seen.has(candidate)) {
      candidate = `${key}_${n++}`
    }
    seen.add(candidate)
    return { ...s, key: candidate }
  })

  const { error } = await supabase
    .from('agent_configs')
    .update({ services: dedupedAndSlugged })
    .eq('workspace_id', workspaceId)
  if (error) {
    return { ok: false, reason: error.message, savedToDb: false }
  }

  try {
    await syncVapiAssistant(supabase, workspaceId, { throwOnError: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, reason: `Saved, but Vapi sync failed: ${msg}`, savedToDb: true }
  }

  revalidatePath('/settings/services')
  return { ok: true }
}
