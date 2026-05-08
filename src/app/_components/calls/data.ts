import { createClient } from '@/lib/supabase/server'
import type { CallDetail } from './types'

// Loads a call's full detail, workspace-scoped via RLS. Used by both the
// standalone /calls/[id] page and the call modal.
export async function fetchCallDetail(callId: string): Promise<CallDetail | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) return null

  const [{ data, error }, { data: agentConfig }] = await Promise.all([
    supabase
      .from('calls')
      .select(`
        id, case_id, vapi_call_id, direction, caller_phone, callee_phone,
        started_at, ended_at, duration_sec, recording_url, transcript, summary,
        outcome, urgency, service_address, service_requested, system_type,
        flagged_for_review, flag_reason,
        customer:customers(id, name, primary_phone, email, address),
        appointments(id, scheduled_for, service_type, status)
      `)
      .eq('id', callId)
      .eq('workspace_id', workspace.id)
      .single(),
    supabase
      .from('agent_configs')
      .select('agent_name')
      .eq('workspace_id', workspace.id)
      .single(),
  ])
  if (error || !data) return null

  // appointments can be returned as an array; we only show the primary
  // appointment for the call here. Subsequent appointments on the same
  // case are surfaced in the case detail page, not the call modal.
  const apptArr = Array.isArray((data as unknown as { appointments?: unknown }).appointments)
    ? (data as unknown as { appointments: { id: string; scheduled_for: string; service_type: string | null; status: string }[] }).appointments
    : []

  return {
    ...(data as unknown as Omit<CallDetail, 'appointment' | 'customer' | 'agent_name'>),
    agent_name: agentConfig?.agent_name ?? null,
    customer: ((data as unknown as { customer: CallDetail['customer'] }).customer) ?? null,
    appointment: apptArr[0] ?? null,
  }
}
