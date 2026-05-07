import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopNav } from '../_components/TopNav'
import { CustomerProfileModal } from '../_components/customer-profile/CustomerProfileModal'
import { CallDetailModal } from '../_components/calls/CallDetailModal'
import { CaseDetailModal } from '../_components/cases/CaseDetailModal'

// Shared auth gate + chrome for every authed surface
// (/dashboard, /calls, /customers, /settings, /schedule). Replaces the
// near-identical per-route layouts that used to live under each folder.
// Unauthed → /login. Mid-onboarding → wizard.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, onboarding_step')
    .eq('owner_id', user.id)
    .single()

  if (!workspace) redirect('/login')

  const { data: settings } = await supabase
    .from('workspace_settings')
    .select('onboarding_completed')
    .eq('workspace_id', workspace.id)
    .single()

  if (!settings?.onboarding_completed) {
    redirect(`/onboarding/${workspace.onboarding_step}`)
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <TopNav userEmail={user.email ?? null} />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
      </main>
      <CustomerProfileModal />
      <CallDetailModal />
      <CaseDetailModal />
    </div>
  )
}
