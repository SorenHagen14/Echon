import type { SupabaseClient } from '@supabase/supabase-js'

// Resolves which workspace a Vapi call belongs to via the dialled Echon
// number. Returns null if no phone_numbers row matches — callers should
// log + drop the event in that case.
export async function workspaceIdForNumber(
  supabase: SupabaseClient,
  e164: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('phone_numbers')
    .select('workspace_id')
    .eq('e164_number', e164)
    .maybeSingle()
  return (data?.workspace_id as string | undefined) ?? null
}

// Looks up a customer by phone within a workspace. The webhook uses this
// to link incoming calls to existing customer records when possible.
export async function customerIdByPhone(
  supabase: SupabaseClient,
  workspaceId: string,
  e164: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('customers')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('primary_phone', e164)
    .maybeSingle()
  return (data?.id as string | undefined) ?? null
}

// Service-role version of `ensureCaseForCall`. Mirrors the user-scoped
// server action in `_components/cases/actions.ts` but runs without an
// authenticated user — callable from the webhook. No-ops for calls
// without a customer_id (those can never have a case).
export async function ensureCaseForCallServer(
  supabase: SupabaseClient,
  workspaceId: string,
  callId: string,
): Promise<string | null> {
  const { data: call } = await supabase
    .from('calls')
    .select('id, case_id, customer_id, started_at, service_requested')
    .eq('id', callId)
    .eq('workspace_id', workspaceId)
    .single()
  if (!call) return null
  if (call.case_id) return call.case_id as string
  if (!call.customer_id) return null

  const { data: openCase } = await supabase
    .from('cases')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('customer_id', call.customer_id)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let caseId: string
  if (openCase) {
    caseId = openCase.id as string
  } else {
    const { data: created, error } = await supabase
      .from('cases')
      .insert({
        workspace_id: workspaceId,
        customer_id: call.customer_id,
        status: 'open',
        title: (call.service_requested as string | null) ?? null,
        opened_at: call.started_at as string,
      })
      .select('id')
      .single()
    if (error || !created) return null
    caseId = created.id as string
  }

  await supabase.from('calls').update({ case_id: caseId }).eq('id', callId)
  await supabase.from('appointments')
    .update({ case_id: caseId })
    .eq('call_id', callId)
    .is('case_id', null)
  return caseId
}
