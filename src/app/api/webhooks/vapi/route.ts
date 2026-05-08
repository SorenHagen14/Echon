import { NextResponse, after } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { processCallEnd } from '@/server/process-call-end'
import { dispatchToolCalls, type ToolCall } from '@/server/voice-tools/dispatch'
import {
  callerPhone,
  calleePhone,
  costCents,
  durationSec,
  endedAt,
  isInboundCall,
  recordingUrl,
  startedAt,
  transcript as parseTranscript,
  vapiCallId,
  type VapiMessage,
} from './_lib/parse'
import {
  customerIdByPhone,
  ensureCaseForCallServer,
  workspaceIdForNumber,
} from './_lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type VapiPayload = { message?: VapiMessage }

function verifySecret(headerValue: string | null): boolean {
  const expected = process.env.VAPI_WEBHOOK_SECRET
  if (!expected || !headerValue) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(headerValue)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  // Try every plausible header name Vapi might use across SDK versions.
  const candidateHeaders = [
    'x-vapi-secret',
    'x-vapi-signature',
    'x-vapi-server-secret',
    'authorization',
  ]
  let secretHeader: string | null = null
  for (const name of candidateHeaders) {
    const v = req.headers.get(name)
    if (v) {
      secretHeader = name === 'authorization' ? v.replace(/^Bearer\s+/i, '') : v
      break
    }
  }

  if (!verifySecret(secretHeader)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let payload: VapiPayload
  try {
    payload = (await req.json()) as VapiPayload
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 })
  }

  const message = payload.message
  if (!message) return NextResponse.json({ ok: true })

  // Test calls (`metadata.test === true`) skip DB writes — used by the
  // onboarding sandbox button so we don't pollute the calls log.
  const isTest = message.call?.metadata?.test === true

  try {
    switch (message.type) {
      case 'status-update':
        if (!isTest) await handleStatusUpdate(message)
        break
      case 'end-of-call-report':
        if (!isTest) await handleEndOfCallReport(message)
        break
      case 'tool-calls': {
        const toolResponse = await handleToolCalls(message)
        return NextResponse.json(toolResponse)
      }
      case 'transcript':
      case 'speech-update':
      case 'conversation-update':
        // Live in-call streams; not persisted.
        break
      default:
        break
    }
  } catch (err) {
    // Log but always 200 the webhook so Vapi doesn't retry endlessly on a
    // bad payload. We can backfill from `raw_end_of_call_report` if needed.
    console.error('[vapi-webhook] handler failed', { type: message.type, err })
  }

  return NextResponse.json({ ok: true })
}

// `status-update` fires multiple times per call (queued → ringing →
// in-progress → ended). We upsert the calls row on every event so the call
// shows up in the dashboard the moment it starts ringing, then enrich it
// as more state arrives. End-of-call data lands in `end-of-call-report`.
async function handleStatusUpdate(m: VapiMessage): Promise<void> {
  const callId = vapiCallId(m)
  if (!callId) return
  const callee = calleePhone(m)
  if (!callee) {
    console.warn('[vapi-webhook] status-update without callee phone — dropping', { callId })
    return
  }

  const supabase = createServiceClient()
  const workspaceId = await workspaceIdForNumber(supabase, callee)
  if (!workspaceId) {
    console.warn('[vapi-webhook] no workspace for callee number', { callId, callee })
    return
  }

  const caller = callerPhone(m)
  const customerId = caller ? await customerIdByPhone(supabase, workspaceId, caller) : null
  const start = startedAt(m)
  const end = endedAt(m)

  // Upsert keyed on vapi_call_id (table has a unique constraint on it).
  // `direction` + `started_at` are only set on insert; subsequent updates
  // shouldn't clobber them with stale values from later events.
  const { data: existing } = await supabase
    .from('calls')
    .select('id, started_at')
    .eq('vapi_call_id', callId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  let dbCallId: string | null = (existing?.id as string | undefined) ?? null

  if (!dbCallId) {
    const { data: inserted, error } = await supabase
      .from('calls')
      .insert({
        workspace_id: workspaceId,
        customer_id: customerId,
        vapi_call_id: callId,
        direction: isInboundCall(m) ? 'inbound' : 'outbound',
        caller_phone: caller,
        callee_phone: callee,
        started_at: start ?? new Date().toISOString(),
        ended_at: end,
      })
      .select('id')
      .single()
    if (error) {
      console.error('[vapi-webhook] calls insert failed', { callId, err: error.message })
      return
    }
    dbCallId = inserted.id as string
  } else {
    // On subsequent status-updates, only update late-binding fields so we
    // don't overwrite the original started_at with a slightly-different
    // value from a later message.
    const updates: Record<string, unknown> = {}
    if (customerId) updates.customer_id = customerId
    if (end) updates.ended_at = end
    if (Object.keys(updates).length > 0) {
      await supabase.from('calls').update(updates).eq('id', dbCallId)
    }
  }

  await supabase.from('call_events').insert({
    workspace_id: workspaceId,
    call_id: dbCallId,
    event_type: `status:${m.status ?? 'unknown'}`,
    payload: m as unknown as Record<string, unknown>,
  })

  // Attach to a case once we know the customer.
  if (customerId) {
    await ensureCaseForCallServer(supabase, workspaceId, dbCallId)
  }
}

// `end-of-call-report` is the final event Vapi sends. We persist the
// recording, transcript, duration, and the raw payload (so a later Inngest
// job can re-summarize without depending on Vapi's history). LLM
// extraction (summary, outcome, structured fields) is Phase 4 step 2 —
// outcome stays at `processing` until then.
async function handleEndOfCallReport(m: VapiMessage): Promise<void> {
  const callId = vapiCallId(m)
  if (!callId) return
  const callee = calleePhone(m)
  if (!callee) return

  const supabase = createServiceClient()
  const workspaceId = await workspaceIdForNumber(supabase, callee)
  if (!workspaceId) return

  const caller = callerPhone(m)
  const customerId = caller ? await customerIdByPhone(supabase, workspaceId, caller) : null

  // Make sure the row exists (status-update may not have arrived if Vapi
  // is configured to send only end-of-call-report).
  const { data: existing } = await supabase
    .from('calls')
    .select('id')
    .eq('vapi_call_id', callId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  let dbCallId: string | null = (existing?.id as string | undefined) ?? null
  if (!dbCallId) {
    const start = startedAt(m) ?? new Date().toISOString()
    const { data: inserted, error } = await supabase
      .from('calls')
      .insert({
        workspace_id: workspaceId,
        customer_id: customerId,
        vapi_call_id: callId,
        direction: isInboundCall(m) ? 'inbound' : 'outbound',
        caller_phone: caller,
        callee_phone: callee,
        started_at: start,
      })
      .select('id')
      .single()
    if (error) {
      console.error('[vapi-webhook] end-of-call insert failed', { callId, err: error.message })
      return
    }
    dbCallId = inserted.id as string
  }

  const updates: Record<string, unknown> = {
    ended_at: endedAt(m) ?? new Date().toISOString(),
    raw_end_of_call_report: m as unknown as Record<string, unknown>,
  }
  const dur = durationSec(m)
  if (dur !== null) updates.duration_sec = dur
  const rec = recordingUrl(m)
  if (rec) updates.recording_url = rec
  const ts = parseTranscript(m)
  if (ts !== null) updates.transcript = ts
  const cost = costCents(m)
  if (cost !== null) updates.cost_cents = cost
  if (customerId) updates.customer_id = customerId

  await supabase.from('calls').update(updates).eq('id', dbCallId)

  await supabase.from('call_events').insert({
    workspace_id: workspaceId,
    call_id: dbCallId,
    event_type: 'end_of_call_report',
    payload: m as unknown as Record<string, unknown>,
  })

  if (customerId) {
    await ensureCaseForCallServer(supabase, workspaceId, dbCallId)
  }

  // Hand off LLM extraction + customer/appointment/case wiring to a
  // post-response task so we don't block Vapi's webhook on a Haiku call.
  // `after()` keeps the function alive until processCallEnd resolves.
  const finalCallId = dbCallId
  after(async () => {
    try {
      await processCallEnd(finalCallId)
    } catch (e) {
      console.error('[vapi-webhook] processCallEnd failed', { callId: finalCallId, err: String(e) })
    }
  })
}

// `tool-calls` events fire mid-call when the agent invokes a function.
// Vapi waits for our response (with timeout) before continuing the
// conversation, so this path is synchronous — no `after()`.
async function handleToolCalls(m: VapiMessage): Promise<{ results: unknown[] }> {
  const callId = vapiCallId(m)
  const callee = calleePhone(m)
  const caller = callerPhone(m)

  // Without a workspace we can't safely run any handler. Return a soft
  // failure to Vapi so the agent says something graceful instead of crashing.
  if (!callId || !callee) {
    return { results: [{ result: '', error: 'Missing call context' }] }
  }

  const supabase = createServiceClient()
  const workspaceId = await workspaceIdForNumber(supabase, callee)
  if (!workspaceId) {
    console.warn('[vapi-webhook] tool-calls: no workspace for callee', { callId, callee })
    return { results: [{ result: '', error: 'Workspace not found' }] }
  }

  // Find the internal calls.id if status-update has already run for this
  // Vapi call. Tools that need to attach data to the call (escalation
  // reason, appointment.call_id) read this.
  const { data: callRow } = await supabase
    .from('calls')
    .select('id')
    .eq('vapi_call_id', callId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  // Vapi has shifted the field name across SDK versions; accept both.
  const rawCalls = (m as unknown as { toolCallList?: unknown; toolCalls?: unknown }).toolCallList
    ?? (m as unknown as { toolCalls?: unknown }).toolCalls
  const toolCalls = Array.isArray(rawCalls) ? (rawCalls as ToolCall[]) : []

  return dispatchToolCalls(
    {
      supabase,
      workspaceId,
      vapiCallId: callId,
      callerPhone: caller,
      callRowId: (callRow?.id as string | undefined) ?? null,
    },
    toolCalls,
  )
}
