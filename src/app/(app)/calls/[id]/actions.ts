'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Toggle flag_for_review on a call. Driven by a `<form action>` so the
// shared `CallDetailBody` (rendered into both server pages and client
// modals) can reference this directly without inline `'use server'`
// closures, which Next.js forbids in the client graph.
export async function toggleFlagForReview(formData: FormData): Promise<void> {
  const callId = formData.get('callId')
  const nextValue = formData.get('nextValue') === 'true'
  const reason = formData.get('reason')
  if (typeof callId !== 'string' || !callId) throw new Error('callId required')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) throw new Error('Workspace not found')

  const { error } = await supabase
    .from('calls')
    .update({
      flagged_for_review: nextValue,
      flag_reason: nextValue && typeof reason === 'string' && reason.trim() ? reason.trim() : null,
    })
    .eq('id', callId)
    .eq('workspace_id', workspace.id)

  if (error) throw new Error(`Flag update failed: ${error.message}`)

  revalidatePath(`/calls/${callId}`)
  revalidatePath('/dashboard')
  revalidatePath('/cases')
}
