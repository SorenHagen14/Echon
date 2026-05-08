// Shared types for the mid-call voice tools the agent can invoke. Vapi
// POSTs `type: 'tool-calls'` to our webhook with one or more pending
// invocations; we dispatch by `function.name`, run the handler, and
// return a string `result` that gets fed back into the conversation.
//
// All handlers receive a workspace-scoped service-role Supabase client
// plus the Vapi call context, so they can read/write workspace data
// without an authenticated user session.

import type { SupabaseClient } from '@supabase/supabase-js'

export type ToolContext = {
  supabase: SupabaseClient
  workspaceId: string
  vapiCallId: string
  callerPhone: string | null
  // The internal `calls.id` for this Vapi call, if it's already been
  // upserted by a `status-update` event. Useful for tools that want to
  // attach data to the call (escalation reason, booked appointment id).
  callRowId: string | null
}

// Vapi-shaped result. `result` is a string that the agent gets to see
// in its next turn. `destination` is only used for transfer/end-call
// flows, where Vapi takes action instead of feeding the result back.
export type ToolResult = {
  toolCallId: string
  result: string
  destination?: {
    type: 'number'
    number: string
    message?: string
  }
  error?: string
}

export type ToolHandler = (
  ctx: ToolContext,
  args: Record<string, unknown>,
) => Promise<{ result: string; destination?: ToolResult['destination']; error?: string }>
