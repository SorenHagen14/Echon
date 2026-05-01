import { createClient } from '@/lib/supabase/server'
import { resetOnboarding } from './actions'

// Placeholder dashboard. Real UI lands alongside the Calls / Schedule /
// Settings routes (see _wireframes/dashboard.md). For now it's the target
// of the post-onboarding redirect and the post-login redirect.
export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isDev = process.env.NODE_ENV !== 'production'

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Placeholder. Signed in as {user?.email ?? 'unknown'}.
        </p>

        {isDev && (
          <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-400">
              Dev tools
            </p>
            <form action={resetOnboarding}>
              <button
                type="submit"
                className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/40"
              >
                Reset onboarding
              </button>
            </form>
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">
              Resets the onboarding cursor and sends you back to <code>/onboarding/1</code>. Disabled in production.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
