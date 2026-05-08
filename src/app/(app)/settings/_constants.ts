// Sidebar IA: five group headers with their subsections listed underneath.
// Each subsection is its own page — clicking it shows only that subsection's
// content, not the whole group stacked.
//
//   Account       — Profile · Notifications
//   Business      — Hours · Services & pricing · Schedule · Team
//   Receptionist  — Voice & persona · After-hours · Escalation
//   Connections   — Echon phone number · Calendar · Other integrations
//   Billing       — Plan & payment

export type SettingsItem = { slug: string; label: string }
export type SettingsGroup = { label: string; items: readonly SettingsItem[] }

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    label: 'Account',
    items: [
      { slug: 'profile',           label: 'Profile' },
      { slug: 'notifications',     label: 'Notifications' },
    ],
  },
  {
    label: 'Business',
    items: [
      { slug: 'location',          label: 'Location' },
      { slug: 'trades',            label: 'Trades' },
      { slug: 'hours',             label: 'Hours' },
      { slug: 'services',          label: 'Services & pricing' },
      { slug: 'schedule',          label: 'Schedule' },
      { slug: 'team',              label: 'Team' },
    ],
  },
  {
    label: 'Receptionist',
    items: [
      { slug: 'voice',             label: 'Voice & persona' },
      { slug: 'role',              label: 'Role & capabilities' },
      { slug: 'after-hours',       label: 'After-hours' },
      { slug: 'escalation',        label: 'Escalation' },
    ],
  },
  {
    label: 'Connections',
    items: [
      { slug: 'phone-number',      label: 'Echon phone number' },
      { slug: 'calendar',          label: 'Calendar' },
      { slug: 'other-integrations',label: 'Other integrations' },
    ],
  },
  {
    label: 'Billing',
    items: [
      { slug: 'plan',              label: 'Plan & payment' },
    ],
  },
] as const

export type SettingsSectionSlug =
  | 'profile' | 'notifications'
  | 'location' | 'trades' | 'hours' | 'services' | 'schedule' | 'team'
  | 'voice' | 'role' | 'after-hours' | 'escalation'
  | 'phone-number' | 'calendar' | 'other-integrations'
  | 'plan'
  | 'dev'

export const SETTINGS_SECTION_SLUGS: readonly SettingsSectionSlug[] = [
  ...SETTINGS_GROUPS.flatMap((g) => g.items.map((i) => i.slug)) as SettingsSectionSlug[],
  'dev',
]

// Only this email sees the dev-tools section in settings.
export const ECHON_ADMIN_EMAIL = 'sorenhagen14@gmail.com'

export const DEFAULT_SETTINGS_SECTION: SettingsSectionSlug = 'profile'

// Single source of truth for "contact support" copy. When the support
// address exists (BACKLOG: Customer support email + intake), update this
// constant — every settings surface that says "contact support" will pick
// it up.
export const SUPPORT_CONTACT = 'support (coming soon)'

// Helper: find a section's label + group given its slug.
export function findSectionMeta(slug: string): { label: string; group: string } | null {
  for (const g of SETTINGS_GROUPS) {
    for (const i of g.items) {
      if (i.slug === slug) return { label: i.label, group: g.label }
    }
  }
  return null
}
