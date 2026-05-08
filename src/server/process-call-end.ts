import { createServiceClient } from '@/lib/supabase/service'
import { extractCallFields } from '@/lib/ai/post-call'
import { ensureCaseForCallServer } from '@/app/api/webhooks/vapi/_lib/db'
import { notify, type NotificationEventType } from '@/lib/notifications'

// Post-call processing: load the call, run Haiku extraction, write back the
// summary + structured fields, upsert the customer if we learned anything,
// create the appointment if booked, and link everything to a case.
//
// Runs after the webhook has 200'd to Vapi (via Next's `after()` helper).
// Uses the service-role client because there's no authenticated user in
// this context — every query explicitly scopes by workspace_id.
//
// Designed to be idempotent on the call row: re-running it overwrites
// summary/outcome/etc. with fresh values. Appointments are NOT recreated
// (we check for an existing appointment on the call first).
export async function processCallEnd(callId: string): Promise<void> {
  const supabase = createServiceClient()

  const { data: call, error } = await supabase
    .from('calls')
    .select(`
      id, workspace_id, customer_id, caller_phone,
      started_at, transcript, outcome, service_address
    `)
    .eq('id', callId)
    .single()
  if (error || !call) {
    console.error('[process-call-end] call not found', { callId, err: error?.message })
    return
  }

  // Pull workspace timezone so we can resolve relative times in the
  // transcript ("tomorrow at 2pm") to a concrete ISO.
  const { data: cfg } = await supabase
    .from('agent_configs')
    .select('timezone, business_hours')
    .eq('workspace_id', call.workspace_id)
    .single()

  let extraction
  try {
    extraction = await extractCallFields({
      transcript: call.transcript,
      startedAtIso: call.started_at as string,
      timezone: (cfg?.timezone as string | null) ?? null,
      callerPhone: (call.caller_phone as string | null) ?? null,
    })
  } catch (e) {
    console.error('[process-call-end] extraction failed', { callId, err: String(e) })
    await supabase.from('calls').update({
      outcome: 'failed',
      flagged_for_review: true,
      flag_reason: 'Post-call extraction errored — see server logs.',
    }).eq('id', callId)
    await notify(supabase, {
      workspaceId: call.workspace_id as string,
      eventType: 'ai_failed',
      callId,
      customerId: (call.customer_id as string | null) ?? null,
      subject: 'AI receptionist hit an error on a call',
      body: 'Echon could not finish processing a call. The call has been flagged for review on your dashboard.',
      payload: { error: String(e) },
    })
    return
  }

  // Update the calls row with everything we learned.
  await supabase.from('calls').update({
    summary: extraction.summary,
    outcome: extraction.outcome,
    urgency: extraction.urgency,
    service_address: extraction.service_address ?? call.service_address ?? null,
    service_requested: extraction.service_requested,
    system_type: extraction.system_type,
    flagged_for_review: extraction.flagged_for_review,
    flag_reason: extraction.flag_reason,
  }).eq('id', callId)

  // Customer: upsert by phone. If we already have a customer_id linked,
  // just enrich the name/address. Otherwise look up by primary_phone, or
  // create a new record.
  let customerId: string | null = (call.customer_id as string | null) ?? null
  const phone = (call.caller_phone as string | null) ?? null

  if (!customerId && phone) {
    const { data: existingByPhone } = await supabase
      .from('customers')
      .select('id')
      .eq('workspace_id', call.workspace_id)
      .eq('primary_phone', phone)
      .maybeSingle()
    if (existingByPhone?.id) {
      customerId = existingByPhone.id as string
    } else if (extraction.customer_name || extraction.service_address) {
      // Only create a record when we actually know something about them.
      const { data: created, error: createErr } = await supabase
        .from('customers')
        .insert({
          workspace_id: call.workspace_id,
          name: extraction.customer_name,
          primary_phone: phone,
          address: extraction.service_address,
        })
        .select('id')
        .single()
      if (!createErr && created) customerId = created.id as string
    }
  }

  if (customerId) {
    // Link the call to the customer.
    if (call.customer_id !== customerId) {
      await supabase.from('calls').update({ customer_id: customerId }).eq('id', callId)
    }
    // Best-effort: backfill name/address on the customer record if we
    // learned them and the existing values are blank.
    const updates: Record<string, unknown> = {}
    if (extraction.customer_name) updates.name = extraction.customer_name
    if (extraction.service_address) updates.address = extraction.service_address
    if (Object.keys(updates).length > 0) {
      // Only fill missing fields — don't clobber existing data.
      const { data: cust } = await supabase
        .from('customers')
        .select('name, address')
        .eq('id', customerId)
        .single()
      const fillable: Record<string, unknown> = {}
      if (extraction.customer_name && !cust?.name) fillable.name = extraction.customer_name
      if (extraction.service_address && !cust?.address) fillable.address = extraction.service_address
      if (Object.keys(fillable).length > 0) {
        await supabase.from('customers').update(fillable).eq('id', customerId)
      }
    }
  }

  // Appointment: insert if outcome=booked, we have appointment data, and
  // there isn't already one on this call.
  if (extraction.outcome === 'booked' && extraction.appointment && customerId) {
    const { data: existingAppt } = await supabase
      .from('appointments')
      .select('id')
      .eq('call_id', callId)
      .maybeSingle()
    if (!existingAppt) {
      await supabase.from('appointments').insert({
        workspace_id: call.workspace_id,
        customer_id: customerId,
        call_id: callId,
        service_type: extraction.appointment.service_type,
        service_address: extraction.service_address ?? null,
        scheduled_for: extraction.appointment.scheduled_for_iso,
        duration_min: extraction.appointment.duration_min,
        status: 'booked',
      })
    }
  }

  // Re-run case linking now that customer_id is set. ensureCaseForCallServer
  // is a no-op if customer_id is still null or a case already exists.
  await ensureCaseForCallServer(supabase, call.workspace_id as string, callId)

  // ---- Notifications ------------------------------------------------------
  // Fire one event per relevant outcome. The dispatcher consults the
  // workspace's notification_prefs and skips disabled types.
  const events = decideNotifications({
    outcome: extraction.outcome,
    urgency: extraction.urgency,
    flagged: extraction.flagged_for_review,
    flagReason: extraction.flag_reason,
    afterHours: isAfterHours(call.started_at as string, cfg ?? null),
  })
  for (const ev of events) {
    await notify(supabase, {
      workspaceId: call.workspace_id as string,
      eventType: ev.type,
      callId,
      customerId,
      subject: ev.subject,
      body: ev.body,
      payload: {
        outcome: extraction.outcome,
        urgency: extraction.urgency,
        service_requested: extraction.service_requested,
        flag_reason: extraction.flag_reason,
      },
    })
  }
}

type Decision = { type: NotificationEventType; subject: string; body: string }

function decideNotifications(input: {
  outcome: string
  urgency: string | null
  flagged: boolean
  flagReason: string | null
  afterHours: boolean
}): Decision[] {
  const out: Decision[] = []
  const summaryLine =
    input.urgency ? `Urgency: ${input.urgency}.` : ''

  if (input.outcome === 'escalated' && input.urgency === 'emergency') {
    out.push({
      type: 'emergency_escalation',
      subject: 'Emergency call — needs a callback now',
      body: `An emergency call just came in and the AI escalated it. ${summaryLine} Open the call in Echon for the transcript.`,
    })
  } else if (input.outcome === 'escalated') {
    out.push({
      type: 'escalation_requested',
      subject: 'AI escalated a call to your team',
      body: `The AI handed off a call. ${summaryLine}`,
    })
  } else if (input.afterHours && (input.outcome === 'no_action' || input.outcome === 'booked')) {
    out.push({
      type: 'after_hours_message',
      subject: 'After-hours call answered',
      body: 'A call came in outside business hours. Open Echon to see what happened.',
    })
  }

  if (input.outcome === 'quote_requested') {
    out.push({
      type: 'quote_request',
      subject: 'New quote request',
      body: 'A caller asked for a quote. Open the call in Echon to follow up.',
    })
  }

  if (input.flagged) {
    out.push({
      type: 'flagged_for_review',
      subject: 'Call flagged for review',
      body: input.flagReason ?? 'The AI flagged this call for review.',
    })
  }

  if (input.outcome === 'failed') {
    out.push({
      type: 'ai_failed',
      subject: 'AI receptionist could not handle a call',
      body: 'Echon ended the call without resolution. Open the call in Echon for details.',
    })
  }

  return out
}

// Cheap business-hours check against agent_configs.business_hours +
// timezone. Returns true when we can't determine a window (better to
// notify than silently swallow).
function isAfterHours(
  startedAtIso: string,
  cfg: { timezone?: string | null; business_hours?: unknown } | null,
): boolean {
  const hours = cfg?.business_hours
  if (!hours || typeof hours !== 'object') return false
  const tz = cfg?.timezone || 'America/New_York'
  let parts: { weekday: string; hour: string; minute: string }
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const obj: Record<string, string> = {}
    for (const p of fmt.formatToParts(new Date(startedAtIso))) {
      if (p.type !== 'literal') obj[p.type] = p.value
    }
    parts = { weekday: obj.weekday ?? '', hour: obj.hour ?? '00', minute: obj.minute ?? '00' }
  } catch {
    return false
  }
  const dayKey = parts.weekday.slice(0, 3).toLowerCase()
  const day = (hours as Record<string, { open?: string; close?: string; closed?: boolean }>)[dayKey]
  if (!day || day.closed) return true
  const now = parts.hour + ':' + parts.minute
  if (!day.open || !day.close) return false
  return now < day.open || now >= day.close
}
