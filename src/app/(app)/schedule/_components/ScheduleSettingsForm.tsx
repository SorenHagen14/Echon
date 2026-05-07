import { updateScheduleSettings } from '../actions'
import type { ScheduleTimeRange, WeekStart } from '../_lib/week'

// Settings form shared by the gear-icon modal on /schedule and the
// Settings → Schedule section. Server-rendered; one form, one action.
export function ScheduleSettingsForm({
  weekStart,
  timeRange,
}: {
  weekStart: WeekStart
  timeRange: ScheduleTimeRange
}) {
  return (
    <form action={updateScheduleSettings} className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">
          Start week on
        </legend>
        <div className="flex flex-wrap gap-4">
          <Radio name="week_start" value="sat" checked={weekStart === 'sat'} label="Saturday" />
          <Radio name="week_start" value="sun" checked={weekStart === 'sun'} label="Sunday" />
          <Radio name="week_start" value="mon" checked={weekStart === 'mon'} label="Monday" />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">
          Visible time range
        </legend>
        <div className="flex flex-wrap gap-4">
          <Radio name="schedule_time_range" value="business" checked={timeRange === 'business'} label="Business hours" />
          <Radio name="schedule_time_range" value="full" checked={timeRange === 'full'} label="24 hours" />
        </div>
      </fieldset>

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          Save
        </button>
      </div>
    </form>
  )
}

function Radio({
  name,
  value,
  checked,
  label,
}: {
  name: string
  value: string
  checked: boolean
  label: string
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={checked}
        className="h-4 w-4 border-zinc-300 text-zinc-900 dark:border-zinc-700"
      />
      {label}
    </label>
  )
}
