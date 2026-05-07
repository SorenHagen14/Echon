import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { cancelWorkspaceDeletion } from '../(app)/settings/account-actions'
import { signOut } from '../(auth)/actions'

// Lockout page shown to owners whose workspace is in the 14-day recovery
// window. Middleware redirects every (app) route here while
// `scheduled_purge_at` is set. From here they can either restore the
// workspace or sign out and let the purge happen.
export default async function DeletionPendingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('deleted_at, scheduled_purge_at')
    .eq('owner_id', user.id)
    .single()

  if (!workspace?.scheduled_purge_at) redirect('/dashboard')

  const purgeAt = new Date(workspace.scheduled_purge_at)
  const now = new Date()
  const msRemaining = purgeAt.getTime() - now.getTime()
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)))

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-8 shadow-sm dark:border-red-900/50 dark:bg-zinc-900">
        <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-white">
          Workspace scheduled for deletion
        </h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          Your workspace is locked while it&apos;s in the recovery window.
          {daysRemaining > 0 ? (
            <>
              {' '}It will be permanently deleted in{' '}
              <span className="font-medium text-zinc-900 dark:text-white">
                {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
              </span>
              {' '}({purgeAt.toLocaleString()}).
            </>
          ) : (
            ' It will be purged in the next scheduled cleanup run.'
          )}
        </p>

        <div className="space-y-3">
          <form action={cancelWorkspaceDeletion}>
            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              Restore my workspace
            </button>
          </form>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Sign out
            </button>
          </form>
        </div>

        <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
          Restoring brings everything back as it was. Once the recovery window
          ends, your customers, cases, calls, and Echon phone number can&apos;t
          be recovered.
        </p>
      </div>
    </div>
  )
}
