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

const DayHoursSchema = z.object({
  open: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time'),
  close: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time'),
  closed: z.boolean(),
})

const WeekHoursSchema = z.object({
  mon: DayHoursSchema,
  tue: DayHoursSchema,
  wed: DayHoursSchema,
  thu: DayHoursSchema,
  fri: DayHoursSchema,
  sat: DayHoursSchema,
  sun: DayHoursSchema,
})

export type HoursResult =
  | { ok: true }
  | { ok: false; reason: string; savedToDb: boolean }

export async function updateBusinessHours(
  _prev: HoursResult | null,
  formData: FormData,
): Promise<HoursResult> {
  const { supabase, workspaceId } = await requireWorkspace()

  const hoursRaw = formData.get('business_hours_json')
  const tzRaw = formData.get('timezone')
  if (typeof hoursRaw !== 'string' || typeof tzRaw !== 'string') {
    return { ok: false, reason: 'Missing form data.', savedToDb: false }
  }

  let hoursObj: unknown
  try {
    hoursObj = JSON.parse(hoursRaw)
  } catch {
    return { ok: false, reason: 'Invalid hours format.', savedToDb: false }
  }
  const parsed = WeekHoursSchema.safeParse(hoursObj)
  if (!parsed.success) {
    return { ok: false, reason: 'Hours format is invalid.', savedToDb: false }
  }

  const tz = tzRaw.trim()
  if (tz.length === 0 || tz.length > 64) {
    return { ok: false, reason: 'Timezone is required.', savedToDb: false }
  }

  const { error } = await supabase
    .from('agent_configs')
    .update({ business_hours: parsed.data, timezone: tz })
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

  revalidatePath('/settings/hours')
  return { ok: true }
}
