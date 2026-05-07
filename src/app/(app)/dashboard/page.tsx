import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { clearFakeCalls, resetOnboarding, seedFakeCalls } from './actions'
import { NeedsAttention } from './_components/NeedsAttention'
import { RecentCalls } from './_components/RecentCalls'
import { MetricsTiles } from './_components/MetricsTiles'
import { UpcomingAppointments } from './_components/UpcomingAppointments'
import { WindowPicker } from './_components/WindowPicker'
import { WINDOW_OPTIONS, type WindowKey } from './_components/window-options'

const isDev = process.env.NODE_ENV !== 'production'
const VALID_WINDOWS = new Set(WINDOW_OPTIONS.map((o) => o.value))

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) redirect('/login')

  const params = await searchParams
  const window: WindowKey = (params.window && VALID_WINDOWS.has(params.window as WindowKey))
    ? (params.window as WindowKey)
    : '7d'

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Dashboard</h1>
        <div className="flex items-center gap-2">
          <WindowPicker current={window} />
          <form action={async () => { 'use server' }}>
            <button
              type="submit"
              aria-label="Refresh"
              title="Refresh"
              className="rounded-md border border-zinc-200 bg-white p-2 text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      <div className="space-y-8">
        <MetricsTiles workspaceId={workspace.id} window={window} />
        <NeedsAttention workspaceId={workspace.id} />
        <UpcomingAppointments workspaceId={workspace.id} />
        <RecentCalls workspaceId={workspace.id} />
      </div>

      {isDev && (
        <div className="mt-12 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-400">
            Dev tools
          </p>
          <div className="flex flex-wrap gap-2">
            <form action={seedFakeCalls}>
              <button
                type="submit"
                className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/40"
              >
                Seed 10 fake calls
              </button>
            </form>
            <form action={clearFakeCalls}>
              <button
                type="submit"
                className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/40"
              >
                Clear fake calls
              </button>
            </form>
            <form action={resetOnboarding}>
              <button
                type="submit"
                className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/40"
              >
                Reset onboarding
              </button>
            </form>
          </div>
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-500">
            Seed inserts 10 sample calls (3 with named customers). Disabled in production.
          </p>
        </div>
      )}
    </div>
  )
}
