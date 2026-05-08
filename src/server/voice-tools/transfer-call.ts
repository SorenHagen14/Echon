import type { ToolHandler } from './types'
import { ensureCaseForCallServer } from '@/app/api/webhooks/vapi/_lib/db'

// transfer_call — live-transfers the caller to the workspace's on-call
// number. This is a Vapi NATIVE `transferCall` tool (not a function tool),
// so Vapi executes the SIP/PSTN handoff itself using the `destinations`
// list baked into the assistant config at sync time. Vapi still POSTs a
// `tool-calls` event to our webhook before transferring, which gives us
// a hook for side effects: marking the call escalated, creating a case,
// emitting an event row.
//
// Why not a function tool with a returned `destination`?
//   Vapi function tools only feed the `result` string back to the model;
//   the `destination` block is ignored. We tried that — the model said
//   "connecting you now" but the call never transferred. This is the
//   canonical Vapi pattern for transfers.
//
// Why not Vapi's transferCall WITHOUT firing the webhook?
//   We need workspace-side state changes (case open, call flagged) to
//   happen at the moment of transfer. The webhook fires before Vapi
//   executes the transfer, so the dashboard reflects the right state
//   even while the caller is still connected.
export const transferCall: ToolHandler = async (ctx, args) => {
  const reason = typeof args.reason === 'string' ? args.reason.trim() : 'Caller asked for a human.'

  // The destinations are baked into the Vapi tool at sync time, so we
  // don't strictly need to look up the number here — but reading it lets
  // us record it on the event row for audit / dashboard purposes.
  const { data: cfg } = await ctx.supabase
    .from('agent_configs')
    .select('oncall_numbers')
    .eq('workspace_id', ctx.workspaceId)
    .single()

  const oncall = Array.isArray(cfg?.oncall_numbers) ? cfg!.oncall_numbers as Array<{ phone?: string }> : []
  const target = oncall.find((n) => typeof n.phone === 'string' && n.phone.trim())

  if (ctx.callRowId) {
    await ctx.supabase.from('calls').update({
      outcome: 'escalated',
      flagged_for_review: true,
      flag_reason: `Live-transferred mid-call: ${reason}`,
    }).eq('id', ctx.callRowId)

    await ctx.supabase.from('call_events').insert({
      workspace_id: ctx.workspaceId,
      call_id: ctx.callRowId,
      event_type: 'transfer_initiated',
      payload: { reason, destination_phone: target?.phone ?? null },
    })

    // ensureCaseForCallServer no-ops when there's no customer_id yet —
    // that's fine, the case will be linked after status-update fills the
    // customer association.
    try {
      await ensureCaseForCallServer(ctx.supabase, ctx.workspaceId, ctx.callRowId)
    } catch (e) {
      console.error('[transfer_call] ensureCase failed', { err: String(e) })
    }
  }

  // Vapi ignores the `result` string for transferCall-type tools — it
  // proceeds with the destination from the assistant config. We return
  // a short ack for log readability.
  return { result: 'Transferring caller to on-call.' }
}

// Vapi `transferCall` type tool. Destinations are populated from the
// workspace's oncall_numbers at assistant-sync time. When oncall_numbers
// is empty, omit this tool entirely from the assistant — the model
// should fall back to escalate_to_human (the prompt makes this explicit).
export function buildTransferCallTool(oncallNumbers: string[] | undefined) {
  const numbers = Array.isArray(oncallNumbers)
    ? oncallNumbers.filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
    : []
  if (numbers.length === 0) return null

  // Vapi requires at least one destination on a transferCall tool. With
  // a single on-call number (the MVP case), we have one destination. If
  // the workspace adds rotation later, more entries land here.
  const destinations = numbers.map((phone) => ({
    type: 'number' as const,
    number: phone,
    message: 'Hold on — connecting you to someone now.',
    description: 'Workspace on-call line',
  }))

  return {
    type: 'transferCall' as const,
    destinations,
    function: {
      name: 'transfer_call',
      description:
        'Live-transfer the caller to the on-call number. Use ONLY when the caller explicitly asks to speak to a person, representative, human, manager, or owner. Vapi connects them to the on-call line; the AI exits the call. The caller hears one short confirmation, one ring tone, then a human voice.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'One short sentence on why we\'re transferring. Recorded for the team.' },
        },
        required: ['reason'],
      },
    },
  }
}
