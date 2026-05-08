import { createClient } from '@/lib/supabase/server'
import { WINDOW_OPTIONS, type WindowKey } from './window-options'

type CallMetricRow = {
  started_at: string
  outcome: string
  caller_phone: string | null
}

type WindowBounds = {
  // [start, now]: the active window
  start: Date
  // [priorStart, start): the prior equivalent window for delta computation.
  // null when the window has no natural prior (all-time).
  priorStart: Date | null
  bucket: 'hour' | 'day' | 'week' | 'month'
  bucketCount: number
  label: string
}

// ---- window math --------------------------------------------------------

function resolveWindow(key: WindowKey): WindowBounds {
  const now = new Date()
  const day = 86_400_000

  switch (key) {
    case 'today': {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      const priorStart = new Date(start.getTime() - day)
      return { start, priorStart, bucket: 'hour', bucketCount: 24, label: 'Today' }
    }
    case '7d': {
      const start = new Date(now.getTime() - 7 * day)
      const priorStart = new Date(now.getTime() - 14 * day)
      return { start, priorStart, bucket: 'day', bucketCount: 7, label: 'Past 7 days' }
    }
    case '30d': {
      const start = new Date(now.getTime() - 30 * day)
      const priorStart = new Date(now.getTime() - 60 * day)
      return { start, priorStart, bucket: 'day', bucketCount: 30, label: 'Past 30 days' }
    }
    case '365d': {
      const start = new Date(now.getTime() - 365 * day)
      const priorStart = new Date(now.getTime() - 2 * 365 * day)
      return { start, priorStart, bucket: 'week', bucketCount: 52, label: 'Past year' }
    }
    case 'ytd': {
      const start = new Date(now.getFullYear(), 0, 1)
      const priorStart = new Date(now.getFullYear() - 1, 0, 1)
      // Use weeks for buckets; count from start of year up to today.
      const weeks = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (7 * day)))
      return { start, priorStart, bucket: 'week', bucketCount: weeks, label: 'Year to date' }
    }
    case 'all':
    default: {
      // No prior — the delta badge hides for "all time".
      const start = new Date(0)
      return { start, priorStart: null, bucket: 'month', bucketCount: 24, label: 'All time' }
    }
  }
}

// ---- bucketing ----------------------------------------------------------

function bucketIndex(date: Date, bounds: WindowBounds): number {
  const ms = date.getTime() - bounds.start.getTime()
  if (ms < 0) return -1
  switch (bounds.bucket) {
    case 'hour':  return Math.floor(ms / 3_600_000)
    case 'day':   return Math.floor(ms / 86_400_000)
    case 'week':  return Math.floor(ms / (7 * 86_400_000))
    case 'month': {
      // Approximate; "all time" sparkline is more vibe than precision.
      return Math.floor(ms / (30 * 86_400_000))
    }
  }
}

// ---- inline visuals -----------------------------------------------------

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) {
    return <div className="h-8 w-full" aria-hidden="true" />
  }
  const max = Math.max(1, ...values)
  const w = 100
  const h = 32
  const stepX = values.length > 1 ? w / (values.length - 1) : 0
  const points = values.map((v, i) => {
    const x = values.length === 1 ? w / 2 : i * stepX
    const y = h - (v / max) * (h - 4) - 2
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  // Polygon for the filled area beneath the line.
  const fillPoints = `0,${h} ${points.join(' ')} ${w},${h}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-8 w-full">
      <polygon points={fillPoints} className="fill-emerald-200/60 dark:fill-emerald-900/40" />
      <polyline points={points.join(' ')} fill="none" strokeWidth="1.5" className="stroke-emerald-600 dark:stroke-emerald-400" />
    </svg>
  )
}

function ConversionBar({ numerator, denominator, accent }: { numerator: number; denominator: number; accent: 'blue' | 'violet' }) {
  const pct = denominator > 0 ? Math.min(100, Math.round((numerator / denominator) * 100)) : 0
  const fill = accent === 'blue'
    ? 'bg-blue-500 dark:bg-blue-400'
    : 'bg-violet-500 dark:bg-violet-400'
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className={`h-full ${fill}`} style={{ width: `${pct}%` }} aria-hidden="true" />
      </div>
      <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
        {numerator} of {denominator} {denominator === 1 ? 'call' : 'calls'} · {pct}%
      </p>
    </div>
  )
}

function DeltaBadge({ current, prior }: { current: number; prior: number | null }) {
  // No prior comparison available (all-time, or prior was zero so a percent
  // can't be computed) → render nothing. The raw value on the tile is the signal.
  if (prior === null || prior === 0) return null

  const delta = ((current - prior) / prior) * 100
  const rounded = Math.round(delta)

  // Color encodes direction: green up, red down, zinc flat.
  const tone =
    rounded > 0
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
      : rounded < 0
        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'

  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : ''
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${tone}`}
      title={`Compared to the prior equivalent window (${prior} → ${current})`}
    >
      {sign}{Math.abs(rounded)}%
    </span>
  )
}

function Tile({
  label,
  value,
  delta,
  children,
}: {
  label: string
  value: number
  delta: { current: number; prior: number | null }
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
        <DeltaBadge current={delta.current} prior={delta.prior} />
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">{value}</p>
      <div className="mt-3">{children}</div>
    </div>
  )
}

// ---- the section --------------------------------------------------------

export async function MetricsTiles({ workspaceId, window }: { workspaceId: string; window: WindowKey }) {
  const supabase = await createClient()
  const bounds = resolveWindow(window)

  // Pull all calls in [priorStart, now] in one query — covers both window
  // counts and prior-window counts. For "all time" priorStart is null and
  // we just pull from epoch.
  const fetchFrom = bounds.priorStart ?? bounds.start

  const { data: callsData, error } = await supabase
    .from('calls')
    .select('started_at, outcome, caller_phone')
    .eq('workspace_id', workspaceId)
    .gte('started_at', fetchFrom.toISOString())
    .order('started_at', { ascending: true })

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Couldn&apos;t load metrics — {error.message}
      </p>
    )
  }

  const calls = (callsData ?? []) as CallMetricRow[]

  // Separate phones we'd seen *before* either window starts, used to identify
  // genuinely-new customers. One small query per cutoff. The "lt priorStart"
  // query is skipped for all-time since there's no prior.
  const phonesBeforePriorStart = new Set<string>()
  if (bounds.priorStart) {
    const { data: priorHist } = await supabase
      .from('calls')
      .select('caller_phone')
      .eq('workspace_id', workspaceId)
      .lt('started_at', bounds.priorStart.toISOString())
      .not('caller_phone', 'is', null)
    priorHist?.forEach((r) => {
      if (r.caller_phone) phonesBeforePriorStart.add(r.caller_phone)
    })
  }

  // Partition the fetched calls into window vs prior.
  const windowCalls: CallMetricRow[] = []
  const priorCalls: CallMetricRow[] = []
  for (const c of calls) {
    const t = new Date(c.started_at)
    if (t >= bounds.start) windowCalls.push(c)
    else if (bounds.priorStart && t >= bounds.priorStart) priorCalls.push(c)
  }

  // Tile 1 — calls handled.
  const callsHandled = windowCalls.length
  const callsHandledPrior = bounds.priorStart ? priorCalls.length : null

  // Sparkline buckets.
  const sparkValues = new Array(bounds.bucketCount).fill(0) as number[]
  for (const c of windowCalls) {
    const idx = bucketIndex(new Date(c.started_at), bounds)
    if (idx >= 0 && idx < sparkValues.length) sparkValues[idx]! += 1
  }

  // Tile 2 — appointments booked + conversion.
  const bookings = windowCalls.filter((c) => c.outcome === 'booked').length
  const bookingsPrior = bounds.priorStart
    ? priorCalls.filter((c) => c.outcome === 'booked').length
    : null

  // Tile 3 — new customers.
  // A phone is "new in window" iff it has at least one call in window AND
  // no calls before window start. "Before window start" = phonesBeforePriorStart
  // (calls < priorStart) UNION phones that had calls in priorCalls (priorStart..start).
  const phonesBeforeWindowStart = new Set<string>(phonesBeforePriorStart)
  for (const c of priorCalls) {
    if (c.caller_phone) phonesBeforeWindowStart.add(c.caller_phone)
  }
  const phonesInWindow = new Set<string>()
  for (const c of windowCalls) {
    if (c.caller_phone) phonesInWindow.add(c.caller_phone)
  }
  const newCustomers = Array.from(phonesInWindow).filter((p) => !phonesBeforeWindowStart.has(p)).length
  const totalCallersInWindow = phonesInWindow.size

  // Prior-window equivalents for the new-customers delta.
  let newCustomersPrior: number | null = null
  if (bounds.priorStart) {
    const phonesInPrior = new Set<string>()
    for (const c of priorCalls) {
      if (c.caller_phone) phonesInPrior.add(c.caller_phone)
    }
    newCustomersPrior = Array.from(phonesInPrior).filter((p) => !phonesBeforePriorStart.has(p)).length
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Tile
        label={`Calls handled · ${WINDOW_OPTIONS.find((o) => o.value === window)?.label ?? bounds.label}`}
        value={callsHandled}
        delta={{ current: callsHandled, prior: callsHandledPrior }}
      >
        <Sparkline values={sparkValues} />
      </Tile>

      <Tile
        label="Appointments booked"
        value={bookings}
        delta={{ current: bookings, prior: bookingsPrior }}
      >
        <ConversionBar numerator={bookings} denominator={callsHandled} accent="blue" />
      </Tile>

      <Tile
        label="New customers"
        value={newCustomers}
        delta={{ current: newCustomers, prior: newCustomersPrior }}
      >
        <ConversionBar numerator={newCustomers} denominator={totalCallersInWindow} accent="violet" />
      </Tile>
    </div>
  )
}
