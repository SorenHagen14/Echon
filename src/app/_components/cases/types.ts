// Isomorphic types + constants shared between server (data.ts, actions.ts)
// and client (CaseSlotPicker, AutoAssignDialog, etc.). Anything that
// imports `@/lib/supabase/server` lives in `data.ts`; that module must
// never be pulled into the client bundle.

export type CaseSlot = 'cs_rep' | 'technician' | 'manager'

export const SLOT_META: Record<CaseSlot, {
  label: string
  eligibilityField: 'is_cs_rep' | 'is_technician' | 'is_manager'
  priorityField: 'priority_cs' | 'priority_tech' | 'priority_manager'
}> = {
  cs_rep:     { label: 'Customer service', eligibilityField: 'is_cs_rep',     priorityField: 'priority_cs' },
  technician: { label: 'Technician',       eligibilityField: 'is_technician', priorityField: 'priority_tech' },
  manager:    { label: 'Manager',          eligibilityField: 'is_manager',    priorityField: 'priority_manager' },
}

export type EligibleOperator = {
  id: string
  name: string
  color: string
  is_cs_rep: boolean
  is_technician: boolean
  is_manager: boolean
  priority_cs: number
  priority_tech: number
  priority_manager: number
}

export type CaseRecord = {
  id: string
  workspace_id: string
  customer_id: string
  status: 'open' | 'closed'
  title: string | null
  notes: string | null
  recommended_action: string | null
  cs_rep_id: string | null
  technician_id: string | null
  manager_id: string | null
  opened_at: string
  closed_at: string | null
}

export type CaseLinkedCall = {
  id: string
  started_at: string
  outcome: string
  service_requested: string | null
}

export type CaseLinkedAppointment = {
  id: string
  scheduled_for: string
  duration_min: number | null
  service_type: string | null
  status: string
}

export type CaseDetail = {
  case: CaseRecord
  customer: { id: string; name: string | null; primary_phone: string | null } | null
  calls: CaseLinkedCall[]
  appointments: CaseLinkedAppointment[]
  operators: EligibleOperator[]
}

export type AutoAssignSlotResult =
  | { slot: CaseSlot; status: 'recommended'; operatorId: string; operatorName: string; operatorColor: string; priority: number; reason: string }
  | { slot: CaseSlot; status: 'kept'; operatorId: string; operatorName: string; operatorColor: string; reason: string }
  | { slot: CaseSlot; status: 'unfilled'; reason: string }

export type AutoAssignReport = { results: AutoAssignSlotResult[] }
