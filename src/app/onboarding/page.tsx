import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Bare /onboarding route. Middleware handles this redirect in the common case,
// but this page is a safety net if middleware is ever bypassed or a request
// lands here directly during deploy rolls.
export default async function OnboardingIndexPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('onboarding_step')
    .eq('owner_id', user.id)
    .single()

  redirect(`/onboarding/${workspace?.onboarding_step ?? 1}`)
}
