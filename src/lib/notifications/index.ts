import type { SupabaseClient } from '@supabase/supabase-js'

// Single entry point for all operator-facing alerts. Every after-hours
// message, escalation, flagged call, and AI failure flows through here.
//
// Today: writes a row to `notification_events` and console-logs. The
// dashboard already surfaces these in the "Needs attention" list via
// flagged_for_review / outcome — so even with no email/SMS transports
// the operator sees the alert.
//
// Later: when SMTP (Resend) and SMS (Twilio) are wired, the transport
// helpers below get bodies and the same row is updated to status='sent'.
// Call sites do not change.

export type NotificationEventType =
  | 'emergency_escalation'   // post-call: outcome=escalated + urgency=emergency
  | 'after_hours_message'    // post-call: outcome=no_action/booked outside hours
  | 'flagged_for_review'     // post-call: extraction.flagged_for_review=true
  | 'quote_request'          // post-call: outcome=quote_requested
  | 'ai_failed'              // post-call: outcome=failed OR processing errored
  | 'escalation_requested'   // mid-call: escalate_to_human tool ran

export type NotifyInput = {
  workspaceId: string
  eventType: NotificationEventType
  callId?: string | null
  caseId?: string | null
  customerId?: string | null
  subject: string
  body: string
  payload?: Record<string, unknown>
}

// Maps event types to the prefs flag that gates them. quote_request and
// ai_failed map directly; escalation_requested + after_hours_message
// piggyback on emergency_escalation since they're the same operator
// audience.
const PREFS_KEY: Record<NotificationEventType, string> = {
  emergency_escalation: 'emergency_escalation',
  after_hours_message:  'emergency_escalation',
  escalation_requested: 'emergency_escalation',
  flagged_for_review:   'flagged_for_review',
  quote_request:        'quote_request',
  ai_failed:            'ai_failed',
}

type Prefs = {
  emergency_escalation?: boolean
  flagged_for_review?:   boolean
  quote_request?:        boolean
  ai_failed?:            boolean
  contact_email?:        string | null
}

// Use a service client when called from webhook/post-call paths, an
// authed client when called from server actions. Either works — both
// can write to notification_events (RLS allows the workspace owner;
// service role bypasses RLS entirely).
export async function notify(
  supabase: SupabaseClient,
  input: NotifyInput,
): Promise<void> {
  const { data: cfg } = await supabase
    .from('agent_configs')
    .select('notification_prefs')
    .eq('workspace_id', input.workspaceId)
    .single()

  const prefs = (cfg?.notification_prefs as Prefs | null) ?? {}
  const enabled = prefs[PREFS_KEY[input.eventType] as keyof Prefs] !== false

  // Resolve the recipient email — explicit pref overrides workspace owner.
  const recipient = await resolveRecipientEmail(supabase, input.workspaceId, prefs.contact_email ?? null)

  // Always record. status=skipped when prefs disabled or no recipient.
  const status: 'queued' | 'skipped' = !enabled || !recipient ? 'skipped' : 'queued'

  await supabase.from('notification_events').insert({
    workspace_id: input.workspaceId,
    event_type: input.eventType,
    call_id: input.callId ?? null,
    case_id: input.caseId ?? null,
    customer_id: input.customerId ?? null,
    status,
    channel: 'inapp',
    recipient: recipient ?? null,
    subject: input.subject,
    body: input.body,
    payload: input.payload ?? {},
  })

  // Console trail until transports are wired so dev can see what would
  // have shipped. Keep this terse — it's hot.
  console.log(
    `[notify] ${input.eventType} ws=${input.workspaceId} status=${status}` +
    (recipient ? ` to=${recipient}` : '') +
    (input.callId ? ` call=${input.callId}` : ''),
  )

  // TODO(post-SMTP): when Resend is configured, queue an email here for
  // status=queued rows and patch status to 'sent' / 'failed' with sent_at.
}

async function resolveRecipientEmail(
  supabase: SupabaseClient,
  workspaceId: string,
  override: string | null,
): Promise<string | null> {
  if (override && override.includes('@')) return override
  // Fall back to the workspace owner's auth email. profiles doesn't
  // store email, so use the admin API when available (service-role
  // path); otherwise return null and let the caller surface a "set
  // your contact email" hint.
  const { data: ws } = await supabase
    .from('workspaces')
    .select('owner_id')
    .eq('id', workspaceId)
    .single()
  if (!ws?.owner_id) return null
  const adminApi = (supabase.auth as { admin?: { getUserById?: (id: string) => Promise<{ data: { user: { email?: string } | null } }> } }).admin
  if (adminApi?.getUserById) {
    try {
      const { data } = await adminApi.getUserById(ws.owner_id as string)
      return data?.user?.email ?? null
    } catch {
      return null
    }
  }
  return null
}
