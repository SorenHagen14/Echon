import type { ToolHandler } from './types'
import { ensureCaseForCallServer } from '@/app/api/webhooks/vapi/_lib/db'

// book_appointment(...) — write the appointment row right now, in-call,
// so the caller hangs up with a real booking on the books. Returns a
// confirmation string for the agent to read back.
//
// If the caller is brand-new, also upserts a customer row so the
// appointment isn't orphaned.
export const bookAppointment: ToolHandler = async (ctx, args) => {
  const customerName = typeof args.customer_name === 'string' ? args.customer_name.trim() : ''
  const customerPhone = (typeof args.customer_phone === 'string' && args.customer_phone.trim())
    || ctx.callerPhone
    || ''
  const serviceType = typeof args.service_type === 'string' ? args.service_type.trim() : 'Service visit'
  const serviceAddress = typeof args.service_address === 'string' ? args.service_address.trim() || null : null
  const scheduledForIso = typeof args.scheduled_for_iso === 'string' ? args.scheduled_for_iso : null
  const durationMin = typeof args.duration_min === 'number' && args.duration_min > 0
    ? Math.round(args.duration_min)
    : 60

  if (!scheduledForIso || Number.isNaN(Date.parse(scheduledForIso))) {
    return { error: 'invalid scheduled_for_iso', result: 'I need a specific date and time before I can book. Could you give me a day and time?' }
  }
  if (!customerName) {
    return { error: 'missing customer_name', result: "I need a name on the appointment. What's the name?" }
  }
  if (!customerPhone) {
    return { error: 'missing customer_phone', result: "What's the best callback number for this booking?" }
  }

  // Upsert customer (find by phone, create if missing). Also patch the
  // call row's customer_id so post-call processing finds the same record.
  let customerId: string | null = null
  const { data: existing } = await ctx.supabase
    .from('customers')
    .select('id, name, address')
    .eq('workspace_id', ctx.workspaceId)
    .eq('primary_phone', customerPhone)
    .maybeSingle()
  if (existing) {
    customerId = existing.id as string
    const fillable: Record<string, unknown> = {}
    if (!existing.name && customerName) fillable.name = customerName
    if (!existing.address && serviceAddress) fillable.address = serviceAddress
    if (Object.keys(fillable).length > 0) {
      await ctx.supabase.from('customers').update(fillable).eq('id', customerId)
    }
  } else {
    const { data: created, error } = await ctx.supabase
      .from('customers')
      .insert({
        workspace_id: ctx.workspaceId,
        name: customerName,
        primary_phone: customerPhone,
        address: serviceAddress,
      })
      .select('id')
      .single()
    if (error || !created) {
      return { error: error?.message ?? 'customer create failed', result: 'I couldn\'t save the booking — something on our end. Let me get a human to help.' }
    }
    customerId = created.id as string
  }

  // Conflict check — refuse to double-book the same slot.
  const slotStart = new Date(scheduledForIso).getTime()
  const slotEnd = slotStart + durationMin * 60_000
  const { data: nearby } = await ctx.supabase
    .from('appointments')
    .select('scheduled_for, duration_min')
    .eq('workspace_id', ctx.workspaceId)
    .gte('scheduled_for', new Date(slotStart - 4 * 60 * 60_000).toISOString())
    .lte('scheduled_for', new Date(slotStart + 4 * 60 * 60_000).toISOString())
    .neq('status', 'canceled')
  if (nearby) {
    for (const a of nearby) {
      const aStart = new Date(a.scheduled_for as string).getTime()
      const aEnd = aStart + ((a.duration_min as number | null) ?? 60) * 60_000
      if (slotStart < aEnd && aStart < slotEnd) {
        return {
          result: 'That slot is already taken — call check_availability for alternatives and offer the caller a different time.',
        }
      }
    }
  }

  const { error: apptErr } = await ctx.supabase.from('appointments').insert({
    workspace_id: ctx.workspaceId,
    customer_id: customerId,
    call_id: ctx.callRowId,
    service_type: serviceType,
    service_address: serviceAddress,
    scheduled_for: scheduledForIso,
    duration_min: durationMin,
    status: 'booked',
  })
  if (apptErr) {
    return { error: apptErr.message, result: 'The save failed — I\'ll get a human to confirm this with you shortly.' }
  }

  // Link to a case so the booking shows up alongside the call.
  if (ctx.callRowId) {
    await ctx.supabase.from('calls').update({ customer_id: customerId }).eq('id', ctx.callRowId)
    await ensureCaseForCallServer(ctx.supabase, ctx.workspaceId, ctx.callRowId)
  }

  const slotLabel = new Date(scheduledForIso).toLocaleString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
  return {
    result: `Booked. Confirmation for the caller: "${customerName}, you're set for ${slotLabel}, ${serviceType}${serviceAddress ? ` at ${serviceAddress}` : ''}." Read that back exactly and end the call.`,
  }
}

export const bookAppointmentToolDef = {
  type: 'function' as const,
  function: {
    name: 'book_appointment',
    description:
      'Book an appointment for the caller in real time. Call this AFTER confirming the time with check_availability and getting the caller\'s explicit yes. Creates the customer record if missing.',
    parameters: {
      type: 'object',
      properties: {
        customer_name: { type: 'string', description: 'Caller\'s full name as they said it.' },
        customer_phone: { type: 'string', description: 'E.164 phone. Defaults to caller ID if omitted.' },
        service_type: { type: 'string', description: 'Short noun phrase: "AC repair", "drain clear-out", "estimate visit".' },
        service_address: { type: 'string', description: 'Street address where the work happens.' },
        scheduled_for_iso: { type: 'string', description: 'ISO 8601 datetime in the workspace timezone (or with offset).' },
        duration_min: { type: 'number', description: 'Appointment length, minutes. Default 60.' },
      },
      required: ['customer_name', 'service_type', 'scheduled_for_iso'],
    },
  },
}
