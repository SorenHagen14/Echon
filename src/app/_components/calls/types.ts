// Isomorphic types for the call detail modal/page. Kept separate from
// `data.ts` so client components can import them without dragging the
// server-only Supabase client into a client bundle.

export type TranscriptTurn = {
  role: 'assistant' | 'user' | 'system' | string
  message: string
  time?: number
  endTime?: number
}

export type CallDetail = {
  id: string
  case_id: string | null
  vapi_call_id: string
  direction: string
  caller_phone: string | null
  callee_phone: string | null
  started_at: string
  ended_at: string | null
  duration_sec: number | null
  recording_url: string | null
  transcript: TranscriptTurn[] | null
  summary: string | null
  outcome: string
  urgency: string | null
  service_address: string | null
  service_requested: string | null
  system_type: string | null
  flagged_for_review: boolean
  flag_reason: string | null
  customer: {
    id: string
    name: string | null
    primary_phone: string | null
    email: string | null
    address: string | null
  } | null
  appointment: {
    id: string
    scheduled_for: string
    service_type: string | null
    status: string
  } | null
}
