import { createClient } from '@/lib/supabase/server'

export type EquipmentItem = {
  id: string
  type: string
  brand?: string
  model?: string
  install_date?: string
  notes?: string
  created_at: string
}

export type CustomerProfile = {
  id: string
  name: string | null
  primary_phone: string | null
  secondary_phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  equipment: EquipmentItem[]
  created_at: string
}

export type TranscriptTurn = {
  role: 'assistant' | 'user' | 'system' | string
  message: string
  time?: number
  endTime?: number
}

export type CallEntry = {
  kind: 'call'
  id: string
  at: string
  outcome: string
  summary: string | null
  service_requested: string | null
  transcript: TranscriptTurn[] | null
}

export type AppointmentEntry = {
  kind: 'appointment'
  id: string
  at: string
  status: string
  service_type: string
  service_address: string | null
  call_id: string | null
}

export type TimelineEntry = CallEntry | AppointmentEntry

export type CustomerProfileData = {
  customer: CustomerProfile
  timeline: TimelineEntry[]
  callCount: number
  apptCount: number
}

// Loads the full profile + merged timeline for a customer scoped to the
// current user's workspace. Returns null when the customer doesn't exist
// or doesn't belong to this workspace.
export async function fetchCustomerProfile(customerId: string): Promise<CustomerProfileData | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) return null

  const [custRes, callsRes, apptsRes] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, primary_phone, secondary_phone, email, address, notes, equipment, created_at')
      .eq('id', customerId)
      .eq('workspace_id', workspace.id)
      .single(),
    supabase
      .from('calls')
      .select('id, started_at, outcome, summary, service_requested, transcript')
      .eq('workspace_id', workspace.id)
      .eq('customer_id', customerId)
      .order('started_at', { ascending: false }),
    supabase
      .from('appointments')
      .select('id, scheduled_for, status, service_type, service_address, call_id')
      .eq('workspace_id', workspace.id)
      .eq('customer_id', customerId)
      .order('scheduled_for', { ascending: false }),
  ])

  if (custRes.error || !custRes.data) return null
  const raw = custRes.data as unknown as Omit<CustomerProfile, 'equipment'> & { equipment: EquipmentItem[] | null }
  const customer: CustomerProfile = {
    ...raw,
    equipment: Array.isArray(raw.equipment) ? raw.equipment : [],
  }

  const timeline: TimelineEntry[] = [
    ...(callsRes.data ?? []).map((c) => ({
      kind: 'call' as const,
      id: c.id as string,
      at: c.started_at as string,
      outcome: c.outcome as string,
      summary: (c.summary as string | null) ?? null,
      service_requested: (c.service_requested as string | null) ?? null,
      transcript: Array.isArray(c.transcript) ? (c.transcript as TranscriptTurn[]) : null,
    })),
    ...(apptsRes.data ?? []).map((a) => ({
      kind: 'appointment' as const,
      id: a.id as string,
      at: a.scheduled_for as string,
      status: a.status as string,
      service_type: a.service_type as string,
      service_address: (a.service_address as string | null) ?? null,
      call_id: (a.call_id as string | null) ?? null,
    })),
  ].sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime())

  return {
    customer,
    timeline,
    callCount: callsRes.data?.length ?? 0,
    apptCount: apptsRes.data?.length ?? 0,
  }
}
