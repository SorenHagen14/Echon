'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { voice } from '@/lib/voice'

export type ImportTwilioResult =
  | { ok: true; e164: string }
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

function normalizeE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length >= 11 && raw.trim().startsWith('+')) return `+${digits}`
  return null
}

// Import a number the customer already owns in their own Twilio account
// into Vapi. Vapi keeps Twilio creds attached so it can answer inbound
// calls and place outbound on the customer's behalf.
//
// We DON'T persist the auth token in our DB — Vapi has it, that's enough.
// We do persist the account SID + the resulting twilio number SID
// (Vapi returns its own id we use to manage the number going forward).
export async function importTwilioNumber(
  _prev: ImportTwilioResult | null,
  formData: FormData,
): Promise<ImportTwilioResult> {
  const numberRaw = String(formData.get('phone_number') ?? '').trim()
  const accountSid = String(formData.get('account_sid') ?? '').trim()
  const authToken = String(formData.get('auth_token') ?? '').trim()

  const e164 = normalizeE164(numberRaw)
  if (!e164) return { ok: false, reason: 'That doesn\'t look like a phone number. Use the full number with country code (e.g. +15125550143).' }
  if (!accountSid.startsWith('AC') || accountSid.length < 32) {
    return { ok: false, reason: 'Account SID should start with "AC" and be 34 characters. Find it on the Twilio console homepage.' }
  }
  if (authToken.length < 30) {
    return { ok: false, reason: 'Auth token looks too short. Click "View" next to the auth token on the Twilio console homepage to copy the full value.' }
  }

  const { supabase, workspaceId } = await requireWorkspace()

  // Already have an active number? Refuse — one number per workspace,
  // matching the Vapi-managed flow.
  const { data: existing } = await supabase
    .from('phone_numbers')
    .select('id, e164_number')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .maybeSingle()
  if (existing) {
    return {
      ok: false,
      reason: `You already have an active number (${existing.e164_number}). Contact support to swap or add another.`,
    }
  }

  // Pull the assistant id so we can attach the imported number to it
  // immediately. If onboarding hasn't created the assistant yet,
  // attaching is skipped — voice-sync will pick it up on the next save.
  const { data: cfg } = await supabase
    .from('agent_configs')
    .select('vapi_assistant_id')
    .eq('workspace_id', workspaceId)
    .single()

  let vapiNumberId: string
  let importedE164: string
  try {
    const out = await voice.importTwilioNumber({
      e164Number: e164,
      twilioAccountSid: accountSid,
      twilioAuthToken: authToken,
    })
    vapiNumberId = out.vapiNumberId
    importedE164 = out.e164
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // Pull a friendlier reason out of Vapi's error body when possible.
    const match = msg.match(/"message":(?:"([^"]+)"|\["([^"]+)"\])/)
    const detail = match?.[1] || match?.[2]
    return {
      ok: false,
      reason: detail
        || 'Vapi rejected the import. Double-check the number is active in Twilio and the SID/token are correct.',
    }
  }

  if (cfg?.vapi_assistant_id) {
    try {
      await voice.attachNumberToAssistant(vapiNumberId, cfg.vapi_assistant_id)
    } catch (e) {
      console.error('[importTwilioNumber] attach failed', e)
      // Don't roll back — the number is imported, just unattached. The
      // user can hit Save in voice settings to re-sync and we'll attach.
    }
  }

  const { error: insertErr } = await supabase.from('phone_numbers').insert({
    workspace_id: workspaceId,
    e164_number: importedE164,
    vapi_number_id: vapiNumberId,
    twilio_sid: accountSid,                  // store account SID, NOT the auth token
    status: 'active',
    source: 'imported',
  })
  if (insertErr) {
    console.error('[importTwilioNumber] DB insert failed', insertErr)
    return { ok: false, reason: insertErr.message }
  }

  revalidatePath('/settings/phone-number')
  return { ok: true, e164: importedE164 }
}
