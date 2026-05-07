import { advanceStep } from '../actions'

// Step 10 — Calendar connect. Skippable, highly recommended.
//
// The "Connect Google Calendar" button is a placeholder until Phase 4 (Google
// OAuth consent screen + Calendar API client). For now, both buttons just
// advance the cursor via advanceStep. When Phase 4 lands, the connect path
// becomes a real OAuth redirect.

const PRIMARY =
  'rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed'

const SECONDARY =
  'rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'

export function Step10Calendar() {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
          Connect your calendar
        </h1>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          Highly recommended
        </span>
      </div>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Connect Google Calendar so your AI can check availability and book
        appointments directly. Without it, the AI can take messages but can&apos;t book.
      </p>

      <div className="mb-6 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900/50">
        <div className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Google OAuth coming in Phase 4
        </div>
        <p className="text-xs text-zinc-500">
          We&apos;ll redirect you to Google, you pick which calendar to use, and we
          show a 2-week look-ahead so you can confirm the right one.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form action={advanceStep}>
          <input type="hidden" name="step" value={10} />
          <button type="submit" className={PRIMARY}>
            Connect Google Calendar
          </button>
        </form>

        <form action={advanceStep}>
          <input type="hidden" name="step" value={10} />
          <button type="submit" className={SECONDARY}>
            Skip — I&apos;ll connect later
          </button>
        </form>
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        You can connect or change your calendar any time from Settings → Integrations.
      </p>
    </div>
  )
}
