// Day · Week · Month segmented control. Only Week is active; Day and Month
// render disabled with a tooltip so the surface area is honest about scope.
export function ViewSwitcher() {
  return (
    <div
      role="tablist"
      aria-label="View"
      className="inline-flex overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800"
    >
      <Tab active={false} disabled label="Day" />
      <Tab active label="Week" />
      <Tab active={false} disabled label="Month" />
    </div>
  )
}

function Tab({ active, disabled, label }: { active: boolean; disabled?: boolean; label: string }) {
  const base = 'px-3 py-1 text-xs font-medium transition-colors border-l first:border-l-0 border-zinc-200 dark:border-zinc-800'
  if (active) {
    return (
      <span className={`${base} bg-zinc-900 text-white dark:bg-white dark:text-zinc-900`}>{label}</span>
    )
  }
  return (
    <span
      title={disabled ? 'Coming soon' : undefined}
      aria-disabled={disabled}
      className={`${base} cursor-not-allowed bg-white text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600`}
    >
      {label}
    </span>
  )
}
