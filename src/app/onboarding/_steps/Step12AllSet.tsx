import { advanceStep } from '../actions'

// Step 12 — finale. Motivational beat instead of a status recap. Confetti
// fires on load via CONFETTI_STEPS in _constants.ts.

export function Step12AllSet() {
  return (
    <div className="text-center">
      <h1 className="mb-3 text-4xl font-semibold tracking-tight text-zinc-900 dark:text-white">
        Go answer every call.
      </h1>
      <p className="mb-10 text-base text-zinc-500 dark:text-zinc-400">
        You&apos;re all set.
      </p>

      <form action={advanceStep} className="flex justify-center">
        <input type="hidden" name="step" value={12} />
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Go to Dashboard
        </button>
      </form>
    </div>
  )
}
