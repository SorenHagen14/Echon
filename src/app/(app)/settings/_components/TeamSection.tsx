import type { BusinessType } from '@/app/onboarding/_constants'
import { OperatorForm } from './OperatorForm'

export type AccessTier = 'full_access' | 'case_resolver' | 'view_only'

export type Operator = {
  id: string
  name: string
  email: string | null
  phone: string | null
  color: string
  role_label: string | null
  access_tier: AccessTier
  is_cs_rep: boolean
  is_technician: boolean
  is_manager: boolean
  priority_cs: number
  priority_tech: number
  priority_manager: number
  created_at: string
}

export const ACCESS_TIER_META: Record<AccessTier, { label: string; blurb: string }> = {
  full_access:   { label: 'Full Access',    blurb: 'Manage everything — settings, team, billing, all cases.' },
  case_resolver: { label: 'Case Resolver',  blurb: 'Resolve cases, edit customer info, manage appointments.' },
  view_only:     { label: 'View Only',      blurb: 'See assigned cases and customer info. No edits.' },
}

export type RoleKey = 'is_cs_rep' | 'is_technician' | 'is_manager'
export type RoleDef = { key: RoleKey; label: string }

const ALL_ROLES: RoleDef[] = [
  { key: 'is_cs_rep',     label: 'Customer service' },
  { key: 'is_technician', label: 'Technician' },
  { key: 'is_manager',    label: 'Manager' },
]

// Trades where the technician role doesn't apply
const TRADES_WITHOUT_TECHNICIAN: Array<BusinessType> = ['deck_fence']

export function getRolesForTrade(businessType: BusinessType | null): RoleDef[] {
  if (businessType && TRADES_WITHOUT_TECHNICIAN.includes(businessType)) {
    return ALL_ROLES.filter((r) => r.key !== 'is_technician')
  }
  return ALL_ROLES
}

export function TeamSection({
  operators,
  businessType,
}: {
  operators: Operator[]
  businessType: BusinessType | null
}) {
  const roles = getRolesForTrade(businessType)

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {operators.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No team members yet. Add the people who do the work — they&apos;ll show up
            in the case slot dropdowns once you assign them a role.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {operators.map((op) => {
              const tags = roles.filter((r) => op[r.key])
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
                          {(tags.length > 0 || op.role_label) && (
                            <span className="flex flex-wrap gap-1">
                              {tags.map((r) => (
                                <span
                                  key={r.key}
                                  className="inline-flex rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                >
                                  {r.label}
                                </span>
                              ))}
                              {op.role_label && (
                                <span className="inline-flex rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                  {op.role_label}
                                </span>
                              )}
                            </span>
                          )}
                          <span
                            className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                              op.access_tier === 'full_access'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : op.access_tier === 'case_resolver'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                            }`}
                          >
                            {ACCESS_TIER_META[op.access_tier].label}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400 dark:text-zinc-600">Edit</span>
                    </summary>
                    <OperatorForm operator={op} availableRoles={roles} />
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
          <OperatorForm availableRoles={roles} />
        </div>
      </details>
    </div>
  )
}
