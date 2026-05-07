import { OperatorForm } from './OperatorForm'

export type Operator = {
  id: string
  name: string
  email: string | null
  phone: string | null
  color: string
  is_cs_rep: boolean
  is_technician: boolean
  is_manager: boolean
  priority_cs: number
  priority_tech: number
  priority_manager: number
  created_at: string
}

const SLOT_TAGS: { key: 'is_cs_rep' | 'is_technician' | 'is_manager'; label: string }[] = [
  { key: 'is_cs_rep',     label: 'CS' },
  { key: 'is_technician', label: 'Tech' },
  { key: 'is_manager',    label: 'Manager' },
]

export function TeamSection({ operators }: { operators: Operator[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {operators.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No team members yet. Add the people who do the work — they&apos;ll show up
            in the case slot dropdowns once you mark them eligible.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {operators.map((op) => {
              const tags = SLOT_TAGS.filter((t) => op[t.key])
              return (
                <li key={op.id} className="px-5 py-4">
                  <details>
                    <summary className="flex cursor-pointer items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="inline-block h-5 w-5 shrink-0 rounded-full border border-zinc-200 dark:border-zinc-700"
                        style={{ backgroundColor: op.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-zinc-900 dark:text-white">{op.name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {(op.email || op.phone) && (
                            <span>{[op.email, op.phone].filter(Boolean).join(' · ')}</span>
                          )}
                          {tags.length > 0 && (
                            <span className="flex flex-wrap gap-1">
                              {tags.map((t) => (
                                <span
                                  key={t.key}
                                  className="inline-flex rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                >
                                  {t.label}
                                </span>
                              ))}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400 dark:text-zinc-600">Edit</span>
                    </summary>
                    <OperatorForm operator={op} />
                  </details>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <details className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          + Add team member
        </summary>
        <div className="border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <OperatorForm />
        </div>
      </details>
    </div>
  )
}
