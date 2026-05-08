import type { ToolHandler } from './types'

// escalate_to_human({ reason, urgency }) — fires when the agent decides
// the call needs a human. Marks the call flagged_for_review with the
// reason, leaves an "escalation_requested" event so the dashboard can
// surface it, and tells the agent what to say back to the caller.
//
// Notifications (SMS to on-call, email digest, etc.) are deferred —
// the SMTP/SMS infra isn't wired yet. The dashboard's "Needs attention"
// list already keys off flagged_for_review, so escalations land there
// in the meantime.
export const escalateToHuman: ToolHandler = async (ctx, args) => {
  const reason = typeof args.reason === 'string' ? args.reason.trim() : 'Caller asked for a human.'
  const urgency = typeof args.urgency === 'string' ? args.urgency.trim().toLowerCase() : 'routine'
  const callerName = typeof args.caller_name === 'string' ? args.caller_name.trim() : null
  const callbackPhone = typeof args.callback_phone === 'string'
    ? args.callback_phone.trim()
    : ctx.callerPhone

  if (ctx.callRowId) {
    await ctx.supabase.from('calls').update({
      flagged_for_review: true,
      flag_reason: reason,
      outcome: 'escalated',
    }).eq('id', ctx.callRowId)

    await ctx.supabase.from('call_events').insert({
      workspace_id: ctx.workspaceId,
      call_id: ctx.callRowId,
      event_type: 'escalation_requested',
      payload: {
        reason,
        urgency,
        caller_name: callerName,
        callback_phone: callbackPhone,
      },
    })
  }

  // Tell the agent what to say back to the caller. Phrasing depends on
  // urgency — emergencies promise a tighter callback window.
  const window =
    urgency === 'emergency' ? 'within 15 minutes'
      : urgency === 'urgent' ? 'within the hour'
      : 'as soon as we can — usually within 2 hours during business hours'

  return {
    result: `Confirm to the caller: "I've flagged this for ${urgency === 'emergency' ? 'our on-call line' : 'our team'} and someone will call you back ${window}." Then end the call. Do NOT keep collecting info.`,
  }
}

export const escalateToHumanToolDef = {
  type: 'function' as const,
  function: {
    name: 'escalate_to_human',
    description:
      'Hand the call off to a human. Use this when the caller asks for a person, when it\'s an emergency, or when the situation is outside what you can handle. Captures the reason + urgency so the team sees a flagged case.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'One short sentence on why this needs a human.' },
        urgency: {
          type: 'string',
          enum: ['emergency', 'urgent', 'routine'],
          description: 'Emergency = same-day risk (gas, flood, no-heat-in-cold). Urgent = same-day discomfort. Routine = next-business-day OK.',
        },
        caller_name: { type: 'string', description: 'Caller\'s name if you have it.' },
        callback_phone: { type: 'string', description: 'E.164 callback number. Defaults to caller ID.' },
      },
      required: ['reason'],
    },
  },
}
