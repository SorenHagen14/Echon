import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

// RLS-bypassing service-role client. ONLY for server-side flows that have
// no authenticated user — currently the Vapi webhook handler. Every query
// run through this client must explicitly scope by workspace_id.
//
// Never expose this to the browser. The service-role key MUST be a
// non-NEXT_PUBLIC env var.
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
