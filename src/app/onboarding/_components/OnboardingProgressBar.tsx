import { labelForStep, TOTAL_STEPS } from '../_constants'

type Props = {
  currentStep: number
  totalSteps?: number
}

export function OnboardingProgressBar({ currentStep, totalSteps = TOTAL_STEPS }: Props) {
  const clamped = Math.max(1, Math.min(currentStep, totalSteps))
  const pct = (clamped / totalSteps) * 100
  const label = labelForStep(clamped)

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-medium">
          Step {clamped} of {totalSteps}
        </span>
        <span>{label}</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Step ${clamped} of ${totalSteps}: ${label}`}
      >
        <div
          className="h-full bg-zinc-900 transition-[width] duration-300 dark:bg-white"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
