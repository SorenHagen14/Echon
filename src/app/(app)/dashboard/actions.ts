'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Dismisses a call from the dashboard "Needs attention" queue. If the call
// has a caller_phone, all unresolved calls from that phone in the 14-day
// window are resolved together — repeat-caller rows represent one situation,
// not three separate ones. The call still shows in Recent Calls and detail
// view; only the triage list filters by attention_resolved_at is null.
export async function resolveAttention(formData: FormData): Promise<void> {
  const callId = formData.get('callId')
  if (typeof callId !== 'string' || !callId) throw new Error('callId required')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) throw new Error('Workspace not found')

  const { data: call, error: fetchErr } = await supabase
    .from('calls')
    .select('id, caller_phone')
    .eq('id', callId)
    .eq('workspace_id', workspace.id)
    .single()
  if (fetchErr || !call) throw new Error('Call not found')

  const now = new Date().toISOString()
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const update = supabase
    .from('calls')
    .update({ attention_resolved_at: now })
    .eq('workspace_id', workspace.id)
    .is('attention_resolved_at', null)
    .gte('started_at', fourteenDaysAgo)

  const { error: updateErr } = call.caller_phone
    ? await update.eq('caller_phone', call.caller_phone)
    : await update.eq('id', call.id)
  if (updateErr) throw new Error(`Resolve failed: ${updateErr.message}`)

  revalidatePath('/dashboard')
}

// Dev-only helper: resets the signed-in user's onboarding cursor and sends
// them back to Step 1. Hard-gated on NODE_ENV so it cannot run in production.
//
// Per-step answer wipes (services, hours, voice config, etc.) land in Phase 5
// once those columns exist on agent_configs. For now this is a cursor reset.
export async function resetOnboarding(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('resetOnboarding is disabled in production')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) throw new Error('Workspace not found')

  await supabase
    .from('workspace_settings')
    .update({ onboarding_completed: false })
    .eq('workspace_id', workspace.id)

  await supabase
    .from('workspaces')
    .update({ onboarding_step: 1 })
    .eq('id', workspace.id)

  revalidatePath('/', 'layout')
  redirect('/onboarding')
}

// ---------------------------------------------------------------------------
// seedFakeCalls — TEST_MODE-only. Wipes any existing test-tagged calls for
// the current workspace and inserts 10 fake calls + a few customers so the
// dashboard sections have something realistic to render. Test-tagged via
// vapi_call_id prefix `seed_` so cleanup is easy and we never collide with
// real Vapi-issued IDs.
// ---------------------------------------------------------------------------

type SampleEquipment = {
  type: string
  brand?: string
  model?: string
  install_date?: string  // YYYY-MM-DD
  notes?: string
}

type SampleCustomer = {
  name: string
  phone: string
  email: string | null
  address: string
  notes?: string
  equipment?: SampleEquipment[]
}

const SAMPLE_CUSTOMERS: SampleCustomer[] = [
  {
    name: 'Sarah Mendez', phone: '+14155550101', email: 'sarah@example.com', address: '432 Elm St, San Francisco, CA',
    notes: 'Two-zone system; upstairs unit is the recurring problem. Customer since 2020 — knows the team. Avoid sending Tech #4 again (last visit didn\'t go well).',
    equipment: [
      { type: 'AC unit (upstairs zone)', brand: 'Trane', model: 'XR14', install_date: '2020-06-15', notes: 'R-410A. Suspected refrigerant leak as of last service; topped off but symptom returned in 18h.' },
      { type: 'AC unit (downstairs zone)', brand: 'Trane', model: 'XR14', install_date: '2020-06-15', notes: 'Operating normally.' },
      { type: 'Gas furnace', brand: 'Trane', model: 'S9V2-VS', install_date: '2020-06-15' },
    ],
  },
  {
    name: 'James Walker', phone: '+14155550102', email: null, address: '78 Pine Ave, San Francisco, CA',
    notes: 'Gate code 4412. Dog in backyard — friendly but barks. Prefers afternoon appointments.',
    equipment: [
      { type: 'Gas furnace', brand: 'Carrier', model: '59TN6', notes: 'Pilot light intermittent. Brief gas smell reported.' },
    ],
  },
  {
    name: 'Priya Patel', phone: '+14155550103', email: 'priya@example.com', address: '901 Oak Rd, Berkeley, CA',
    notes: 'Considering full replacement. Written quote sent to priya@example.com — follow up in 48 hours if no response.',
    equipment: [
      { type: 'Heat pump', brand: 'Carrier', model: '25HCB6', install_date: '2018-04-22', notes: 'Single-stage. Short-cycling 3-5 min intervals; outdoor unit louder over time.' },
    ],
  },
  {
    name: 'Emma Chen', phone: '+14155550105', email: 'emma@example.com', address: '556 Cedar Dr, San Francisco, CA',
    notes: 'First-time customer (found us via Google). Interested in our recurring service plan — bring brochure on first visit.',
    equipment: [
      { type: 'Central AC', brand: 'Lennox', model: 'EL16XC1', install_date: '2023-05-10', notes: 'Installed by another company. ~3 years old.' },
    ],
  },
]

type SeedCall = {
  customerKey: 'sarah' | 'james' | 'priya' | 'emma' | null
  unknownPhoneSuffix?: string
  minutesAgo: number
  durationSec: number
  outcome: 'booked' | 'quote_requested' | 'escalated' | 'no_action' | 'hung_up' | 'failed'
  service: string
  summary: string                      // newline-separated bullet lines — what happened
  recommendedAction?: string           // newline-separated bullet lines — what to do next
  appointmentInDays?: number           // only for booked w/ known customer
  appointmentHour?: number             // 24h
}

// Designed to exercise the dashboard:
//  - Sarah calls 3× in last ~36h (repeat-caller scenario — needs human eyes)
//  - One booked call gets an appointment so the row can show "Booked Tue 2pm"
//  - Two-bullet summaries so a human handing off knows where it left
const SEED_CALLS: SeedCall[] = [
  // Sarah — call #3 (most recent). Escalated after AI couldn't resolve.
  // recommended_action intentionally omitted from seed — exercises the
  // on-demand "Generate" sparkle button on first view.
  { customerKey: 'sarah', minutesAgo: 35, durationSec: 142, outcome: 'escalated', service: 'AC repair',
    summary:
      '• Third call in 36 hours about the same AC issue at 432 Elm St.\n' +
      '• Original symptom: upstairs zone blowing warm air; downstairs zone working normally.\n' +
      '• Tech visited yesterday afternoon and reported the system was "low on refrigerant"; topped it off and left.\n' +
      '• Today: upstairs zone is blowing warm again — symptom returned within 18 hours of the tech leaving.\n' +
      '• Customer is frustrated, asked for a manager callback ASAP, and is questioning the diagnosis.' },
  // James — fresh booked w/ appointment
  { customerKey: 'james', minutesAgo: 95, durationSec: 287, outcome: 'booked', service: 'Furnace repair',
    summary:
      '• Furnace not igniting this morning; pilot light is out and won\'t relight.\n' +
      '• Customer smelled gas briefly when trying to relight — opened windows, smell dissipated within 10 minutes.\n' +
      '• Two-story home, single furnace in basement. System age unknown.\n' +
      '• Booked diagnostic visit — gate code 4412, dog in backyard.',
    appointmentInDays: 1, appointmentHour: 14 },
  // Sarah — call #2. Customer said "that's not soon enough" — agent should
  // have escalated rather than ending no_action. Seed reflects the correct
  // behavior so the dashboard shows what the right outcome looks like; the
  // Vapi agent prompt needs a matching rule (BACKLOG note).
  { customerKey: 'sarah', minutesAgo: 60 * 5, durationSec: 198, outcome: 'escalated', service: 'AC repair',
    summary:
      '• Follow-up on yesterday\'s AC repair call — wanted an ETA on the tech.\n' +
      '• AI told her the tech was scheduled for tomorrow; she pushed back: "that\'s not soon enough."\n' +
      '• AI escalated to a human after she rejected the next-day slot — needs immediate dispatch decision.' },
  // Priya — quote requested
  { customerKey: 'priya', minutesAgo: 60 * 7, durationSec: 412, outcome: 'quote_requested', service: 'Heat pump diagnostic',
    summary:
      '• Heat pump short-cycling (turning on/off every 3-5 minutes) for ~2 weeks.\n' +
      '• 8-year-old Carrier unit, single-stage. Customer says noise from outdoor unit has gotten louder.\n' +
      '• Wants a written quote emailed before scheduling — sent to priya@example.com.' },
  // Emma — booked w/ appointment
  { customerKey: 'emma', minutesAgo: 60 * 9, durationSec: 244, outcome: 'booked', service: 'AC maintenance',
    summary:
      '• Annual maintenance for a first-time customer — found us via Google.\n' +
      '• No active issues; system is ~3 years old, installed by a different company.\n' +
      '• Booked for next week; mentioned interest in a recurring service plan.',
    appointmentInDays: 6, appointmentHour: 10 },
  // Sarah — call #1 (yesterday afternoon, the original booking)
  { customerKey: 'sarah', minutesAgo: 60 * 28, durationSec: 321, outcome: 'booked', service: 'AC repair',
    summary:
      '• AC blowing warm air; 2-story home, upstairs zone affected only.\n' +
      '• Booked next-day diagnostic — confirmed service address 432 Elm St.\n' +
      '• Customer noted the system is ~6 years old and was installed by us originally.',
    appointmentInDays: 0, appointmentHour: 15 },
  // Unknown caller — short hang-up
  { customerKey: null, unknownPhoneSuffix: '2001', minutesAgo: 60 * 11, durationSec: 12, outcome: 'hung_up', service: 'AC repair',
    summary: '• Caller hung up immediately after greeting — no info captured.\n• Number not in customer database.' },
  // Unknown — general inquiry
  { customerKey: null, unknownPhoneSuffix: '2002', minutesAgo: 60 * 14, durationSec: 88, outcome: 'no_action', service: 'Thermostat install',
    summary: '• Asked whether we install Nest thermostats — confirmed yes.\n• Said they\'d call back after checking with their spouse.' },
  // Unknown — failed
  { customerKey: null, unknownPhoneSuffix: '2003', minutesAgo: 60 * 19, durationSec: 6, outcome: 'failed', service: 'AC repair',
    summary: '• Call dropped almost immediately — likely connection issue.\n• No transcript captured.' },
  // Unknown — quote
  { customerKey: null, unknownPhoneSuffix: '2004', minutesAgo: 60 * 22, durationSec: 356, outcome: 'quote_requested', service: 'AC install',
    summary:
      '• 2,400 sqft single-story home; existing AC is 14 years old, R-22 refrigerant.\n' +
      '• Considering full system replacement — also asked about heat pump options.\n' +
      '• Requested in-home estimate — gave name "Marcus Johnson" but did not confirm a callback number.' },
]

export async function seedFakeCalls(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seedFakeCalls is disabled in production')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) throw new Error('Workspace not found')

  // Wipe prior seed data so reseeding is idempotent. Order matters: appointments
  // FK calls (set null) and customers (restrict), so kill appointments first.
  await supabase.from('appointments').delete().eq('workspace_id', workspace.id).like('notes', 'seed:%')
  await supabase.from('calls').delete().eq('workspace_id', workspace.id).like('vapi_call_id', 'seed_%')
  await supabase.from('customers').delete().eq('workspace_id', workspace.id).like('primary_phone', '+1415555010%')

  const nowIso = new Date().toISOString()
  const customerInserts = SAMPLE_CUSTOMERS.map((c) => ({
    workspace_id: workspace.id,
    name: c.name,
    primary_phone: c.phone,
    email: c.email,
    address: c.address,
    notes: c.notes ?? null,
    equipment: (c.equipment ?? []).map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      created_at: nowIso,
    })),
  }))
  const { data: customers, error: custErr } = await supabase
    .from('customers')
    .insert(customerInserts)
    .select('id, name, primary_phone')
  if (custErr) throw new Error(`Seed customers failed: ${custErr.message}`)

  const customerByKey: Record<string, { id: string; name: string | null; primary_phone: string | null }> = {}
  customers?.forEach((c) => {
    if (c.primary_phone === '+14155550101') customerByKey.sarah = c
    if (c.primary_phone === '+14155550102') customerByKey.james = c
    if (c.primary_phone === '+14155550103') customerByKey.priya = c
    if (c.primary_phone === '+14155550105') customerByKey.emma = c
  })

  const now = Date.now()
  const callRows = SEED_CALLS.map((c, i) => {
    const startedAt = new Date(now - c.minutesAgo * 60_000)
    const endedAt = new Date(startedAt.getTime() + c.durationSec * 1000)
    const customer = c.customerKey ? customerByKey[c.customerKey] : null
    const callerPhone = customer?.primary_phone ?? `+1415555${c.unknownPhoneSuffix}`
    return {
      workspace_id: workspace.id,
      customer_id: customer?.id ?? null,
      vapi_call_id: `seed_${i}_${now}`,
      direction: 'inbound' as const,
      caller_phone: callerPhone,
      callee_phone: '+14155559999',
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      duration_sec: c.durationSec,
      outcome: c.outcome,
      summary: c.summary,
      recommended_action: c.recommendedAction ?? null,
      service_requested: c.service,
    }
  })

  const { data: insertedCalls, error: callsErr } = await supabase
    .from('calls')
    .insert(callRows)
    .select('id, vapi_call_id')
  if (callsErr) throw new Error(`Seed calls failed: ${callsErr.message}`)

  // Build appointments for booked calls that have a known customer + scheduled time.
  const callIdByVapi = new Map(insertedCalls?.map((c) => [c.vapi_call_id, c.id]) ?? [])
  const appointmentInserts = SEED_CALLS.flatMap((c, i) => {
    if (c.outcome !== 'booked' || !c.customerKey || c.appointmentInDays === undefined || c.appointmentHour === undefined) return []
    const customer = customerByKey[c.customerKey]
    if (!customer) return []
    const scheduled = new Date()
    scheduled.setDate(scheduled.getDate() + c.appointmentInDays)
    scheduled.setHours(c.appointmentHour, 0, 0, 0)
    return [{
      workspace_id: workspace.id,
      customer_id: customer.id,
      call_id: callIdByVapi.get(`seed_${i}_${now}`) ?? null,
      service_type: c.service,
      scheduled_for: scheduled.toISOString(),
      duration_min: 60,
      status: 'booked' as const,
      notes: `seed:${i}`,
    }]
  })

  if (appointmentInserts.length > 0) {
    const { error: apptErr } = await supabase.from('appointments').insert(appointmentInserts)
    if (apptErr) throw new Error(`Seed appointments failed: ${apptErr.message}`)
  }

  revalidatePath('/dashboard')
}

export async function clearFakeCalls(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('clearFakeCalls is disabled in production')
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) throw new Error('Workspace not found')

  await supabase.from('appointments').delete().eq('workspace_id', workspace.id).like('notes', 'seed:%')
  await supabase.from('calls').delete().eq('workspace_id', workspace.id).like('vapi_call_id', 'seed_%')
  await supabase.from('customers').delete().eq('workspace_id', workspace.id).like('primary_phone', '+1415555010%')

  revalidatePath('/dashboard')
}
