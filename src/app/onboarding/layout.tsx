import { TEST_MODE } from './_constants'
import { devSkipToDashboard } from './actions'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 pt-10 pb-16 dark:bg-zinc-950">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <span className="text-2xl font-semibold text-zinc-900 dark:text-white">Echon</span>
        </div>
        {TEST_MODE && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            <span>Test mode — required fields are off (dev only)</span>
            <form action={devSkipToDashboard}>
              <button
                type="submit"
                className="rounded bg-amber-200 px-2 py-1 text-amber-900 transition-colors hover:bg-amber-300 dark:bg-amber-900/60 dark:text-amber-100 dark:hover:bg-amber-900"
              >
                Skip to dashboard →
              </button>
            </form>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
