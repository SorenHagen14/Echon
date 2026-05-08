import type { ToolHandler } from './types'

// lookup_customer({ phone }) — given an E.164 phone number, return the
// customer record + a concise summary the agent can use to skip
// re-asking ("Hi Bob, calling about the AC again?").
//
// Returns "Not found" if the number doesn't match any customer; the
// agent should treat them as new.
export const lookupCustomer: ToolHandler = async (ctx, args) => {
  const phoneRaw = typeof args.phone === 'string' ? args.phone : ctx.callerPhone
  if (!phoneRaw) {
    return { result: 'No phone number provided. Treat as a new caller.' }
  }
  const phone = phoneRaw.trim()

  const { data: customer } = await ctx.supabase
    .from('customers')
    .select('id, name, primary_phone, address, notes, created_at')
    .eq('workspace_id', ctx.workspaceId)
    .eq('primary_phone', phone)
    .maybeSingle()

  if (!customer) {
    return { result: 'Not found. Treat as a new caller — collect name, address, and reason normally.' }
  }

  // Pull a count of recent calls + the latest service request summary so
  // the agent can pivot quickly ("calling about the AC again?").
  const { data: recentCalls } = await ctx.supabase
    .from('calls')
    .select('started_at, service_requested, outcome, summary')
    .eq('workspace_id', ctx.workspaceId)
    .eq('customer_id', customer.id)
    .order('started_at', { ascending: false })
    .limit(3)

  const lines: string[] = [
    `Customer: ${customer.name ?? 'name on file blank'}`,
    customer.address ? `Address: ${customer.address}` : 'Address on file: none',
  ]
  if (customer.notes) lines.push(`Notes: ${customer.notes}`)
  if (recentCalls && recentCalls.length > 0) {
    const last = recentCalls[0]
    lines.push(`Last call: ${new Date(last.started_at as string).toLocaleDateString('en-US')} — ${last.service_requested ?? 'service request'} (${last.outcome})`)
    if (recentCalls.length > 1) {
      lines.push(`Total prior calls: ${recentCalls.length}`)
    }
  } else {
    lines.push('No prior calls.')
  }

  return { result: lines.join('. ') + '.' }
}

export const lookupCustomerToolDef = {
  type: 'function' as const,
  function: {
    name: 'lookup_customer',
    description:
      'Look up an existing customer by phone number. Use this at the start of the call (the caller phone is auto-passed) to skip asking for name/address if we already have them. Returns "Not found" for new callers.',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'E.164 phone number to look up. Defaults to the caller ID if omitted.',
        },
      },
    },
  },
}
