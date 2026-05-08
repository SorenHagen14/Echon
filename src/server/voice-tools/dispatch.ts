import { lookupCustomer } from './lookup-customer'
import { checkAvailability } from './check-availability'
import { bookAppointment } from './book-appointment'
import { escalateToHuman } from './escalate-to-human'
import { transferCall } from './transfer-call'
import type { ToolContext, ToolHandler, ToolResult } from './types'

const HANDLERS: Record<string, ToolHandler> = {
  lookup_customer: lookupCustomer,
  check_availability: checkAvailability,
  book_appointment: bookAppointment,
  escalate_to_human: escalateToHuman,
  transfer_call: transferCall,
}

export type ToolCall = {
  id: string
  function?: {
    name?: string
    arguments?: string | Record<string, unknown>
  }
}

// Runs all tool calls in a Vapi `tool-calls` webhook payload, returning
// the result objects in the shape Vapi expects: { results: [{ toolCallId, result, ... }] }.
export async function dispatchToolCalls(
  ctx: ToolContext,
  toolCalls: ToolCall[],
): Promise<{ results: ToolResult[] }> {
  const results: ToolResult[] = []

  for (const call of toolCalls) {
    const id = call.id
    const name = call.function?.name ?? ''
    const handler = HANDLERS[name]

    if (!handler) {
      results.push({
        toolCallId: id,
        result: '',
        error: `Unknown tool: ${name}`,
      })
      continue
    }

    let args: Record<string, unknown> = {}
    const rawArgs = call.function?.arguments
    if (typeof rawArgs === 'string' && rawArgs.trim()) {
      try {
        args = JSON.parse(rawArgs)
      } catch {
        results.push({ toolCallId: id, result: '', error: 'Invalid JSON arguments' })
        continue
      }
    } else if (rawArgs && typeof rawArgs === 'object') {
      args = rawArgs as Record<string, unknown>
    }

    try {
      const out = await handler(ctx, args)
      results.push({
        toolCallId: id,
        result: out.result,
        destination: out.destination,
        error: out.error,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[voice-tools] handler threw', { name, err: msg })
      results.push({
        toolCallId: id,
        result: 'Sorry, something on our end failed. Tell the caller we\'ll have someone call them back.',
        error: msg,
      })
    }
  }

  return { results }
}

// Pull every tool definition for the assistant payload Vapi sends to
// the model. Order doesn't matter; the LLM picks based on description.
export { lookupCustomerToolDef } from './lookup-customer'
export { checkAvailabilityToolDef } from './check-availability'
export { bookAppointmentToolDef } from './book-appointment'
export { escalateToHumanToolDef } from './escalate-to-human'
export { transferCallToolDef } from './transfer-call'
