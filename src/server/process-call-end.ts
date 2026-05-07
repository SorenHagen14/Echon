import { createServiceClient } from '@/lib/supabase/service'
import { extractCallFields } from '@/lib/ai/post-call'
import { ensureCaseForCallServer } from '@/app/api/webhooks/vapi/_lib/db'

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
    .select('timezone')
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
}
