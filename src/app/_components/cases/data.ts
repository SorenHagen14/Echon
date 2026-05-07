import { createClient } from '@/lib/supabase/server'
import type {
  CaseDetail,
  CaseLinkedAppointment,
  CaseLinkedCall,
  CaseRecord,
  EligibleOperator,
} from './types'

// Re-exports for callers that already import everything from this module.
// New code should import types from './types' directly so no isomorphic
// caller drags the server-only Supabase client into a client bundle.
export type {
  CaseDetail,
  CaseLinkedAppointment,
  CaseLinkedCall,
  CaseRecord,
  EligibleOperator,
} from './types'

// Loads everything the case section on /calls/[id] needs in one shot.
// Workspace scoping is enforced by RLS; we still pass workspace_id on
// queries so the planner uses the workspace indexes.
export async function fetchCaseDetail(caseId: string, workspaceId: string): Promise<CaseDetail | null> {
  const supabase = await createClient()

  const [caseRes, callsRes, apptsRes, opsRes] = await Promise.all([
    supabase
      .from('cases')
      .select('id, workspace_id, customer_id, status, title, notes, recommended_action, cs_rep_id, technician_id, manager_id, opened_at, closed_at, customer:customers(id, name, primary_phone)')
      .eq('id', caseId)
      .eq('workspace_id', workspaceId)
      .single(),
    supabase
      .from('calls')
      .select('id, started_at, outcome, service_requested')
      .eq('workspace_id', workspaceId)
      .eq('case_id', caseId)
      .order('started_at', { ascending: false }),
    supabase
      .from('appointments')
      .select('id, scheduled_for, duration_min, service_type, status')
      .eq('workspace_id', workspaceId)
      .eq('case_id', caseId)
      .order('scheduled_for', { ascending: true }),
    supabase
      .from('operators')
      .select('id, name, color, is_cs_rep, is_technician, is_manager, priority_cs, priority_tech, priority_manager')
      .eq('workspace_id', workspaceId)
      .order('name', { ascending: true }),
  ])

  if (caseRes.error || !caseRes.data) return null

  const raw = caseRes.data as unknown as CaseRecord & { customer: CaseDetail['customer'] }
  const { customer, ...caseRow } = raw

  return {
    case: caseRow,
    customer: customer ?? null,
    calls: (callsRes.data ?? []) as CaseLinkedCall[],
    appointments: (apptsRes.data ?? []) as CaseLinkedAppointment[],
    operators: (opsRes.data ?? []) as EligibleOperator[],
  }
}

// Recent calls for the same customer that belong to a *different* open case
// — fed into the merge-cases dialog so the user can see candidate cases by
// browsing recent calls.
export async function fetchMergeCandidates(opts: {
  workspaceId: string
  customerId: string
  excludeCaseId: string
  limit?: number
}): Promise<{
  callId: string
  caseId: string
  caseTitle: string | null
  caseStatus: 'open' | 'closed'
  startedAt: string
  outcome: string
  serviceRequested: string | null
  callCount: number
  appointmentCount: number
}[]> {
  const { workspaceId, customerId, excludeCaseId, limit = 25 } = opts
  const supabase = await createClient()

  const { data: calls } = await supabase
    .from('calls')
    .select('id, case_id, started_at, outcome, service_requested')
    .eq('workspace_id', workspaceId)
    .eq('customer_id', customerId)
    .neq('case_id', excludeCaseId)
    .not('case_id', 'is', null)
    .order('started_at', { ascending: false })
    .limit(limit)

  const rows = (calls ?? []) as { id: string; case_id: string; started_at: string; outcome: string; service_requested: string | null }[]
  if (rows.length === 0) return []

  const caseIds = Array.from(new Set(rows.map((r) => r.case_id)))

  const [{ data: caseRows }, { data: caseCallCounts }, { data: caseApptCounts }] = await Promise.all([
    supabase.from('cases').select('id, title, status').in('id', caseIds),
    supabase.from('calls').select('case_id').in('case_id', caseIds),
    supabase.from('appointments').select('case_id').in('case_id', caseIds),
  ])

  const titleByCase = new Map<string, { title: string | null; status: 'open' | 'closed' }>()
  for (const row of (caseRows ?? []) as { id: string; title: string | null; status: 'open' | 'closed' }[]) {
    titleByCase.set(row.id, { title: row.title, status: row.status })
  }
  const callCount = new Map<string, number>()
  for (const r of (caseCallCounts ?? []) as { case_id: string }[]) {
    callCount.set(r.case_id, (callCount.get(r.case_id) ?? 0) + 1)
  }
  const apptCount = new Map<string, number>()
  for (const r of (caseApptCounts ?? []) as { case_id: string }[]) {
    apptCount.set(r.case_id, (apptCount.get(r.case_id) ?? 0) + 1)
  }

  return rows.map((r) => ({
    callId: r.id,
    caseId: r.case_id,
    caseTitle: titleByCase.get(r.case_id)?.title ?? null,
    caseStatus: titleByCase.get(r.case_id)?.status ?? 'open',
    startedAt: r.started_at,
    outcome: r.outcome,
    serviceRequested: r.service_requested,
    callCount: callCount.get(r.case_id) ?? 0,
    appointmentCount: apptCount.get(r.case_id) ?? 0,
  }))
}
