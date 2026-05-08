import type { ToolHandler } from './types'

// transfer_call({ reason }) — live-transfer to the workspace's on-call
// number. Returns a Vapi `destination` block; Vapi handles the actual
// SIP/PSTN handoff so the caller hears one ring tone and lands on a
// person.
//
// We do NOT use Vapi's built-in `transferCall` tool because the
// destination is workspace-specific (pulled from agent_configs.oncall_numbers)
// and we want a server-controlled choice rather than a hardcoded number
// in the assistant config.
export const transferCall: ToolHandler = async (ctx, args) => {
  const reason = typeof args.reason === 'string' ? args.reason.trim() : 'Caller asked for a human.'

  const { data: cfg } = await ctx.supabase
    .from('agent_configs')
    .select('oncall_numbers')
    .eq('workspace_id', ctx.workspaceId)
    .single()

  const oncall = Array.isArray(cfg?.oncall_numbers) ? cfg!.oncall_numbers as Array<{ phone?: string }> : []
  const target = oncall.find((n) => typeof n.phone === 'string' && n.phone.trim())

  if (!target?.phone) {
    return {
      result: 'No on-call number is configured. Tell the caller "I\'ll have someone call you right back" and use escalate_to_human instead.',
    }
  }

  // Mark the call so the dashboard reflects what happened.
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
      payload: { reason, destination_phone: target.phone },
    })
  }

  return {
    result: 'Transferring now.',
    destination: {
      type: 'number',
      number: target.phone,
      message: 'Hold on — connecting you to someone now.',
    },
  }
}

export const transferCallToolDef = {
  type: 'function' as const,
  function: {
    name: 'transfer_call',
    description:
      'Live-transfer the caller to the on-call number. Use this for emergencies or when the caller specifically asks "let me speak to a person" and a real-time handoff is better than a callback. The caller will hear one ring tone and land on a human.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'One short sentence on why we\'re transferring. Recorded for the team.' },
      },
      required: ['reason'],
    },
  },
}
