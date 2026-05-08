// Sidebar IA. Each subsection is its own page; clicking it shows only that
// subsection's content. `keywords` feed the search bar so people can find
// a control without remembering which group it lives under.
// `comingSoon` items get pushed into a collapsed group at the bottom of
// the rail so the live UI doesn't drown in placeholders.

export type SettingsItem = {
  slug: string
  label: string
  keywords?: readonly string[]   // search aliases ("oncall", "transfer", "escalation phone")
  comingSoon?: boolean
}
export type SettingsGroup = { label: string; items: readonly SettingsItem[] }

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    label: 'Account',
    items: [
      { slug: 'profile',           label: 'Profile',
        keywords: ['name', 'email', 'password', 'avatar', 'sign out'] },
      { slug: 'notifications',     label: 'Notifications',
        keywords: ['email', 'sms', 'alerts', 'digest'], comingSoon: true },
    ],
  },
  {
    label: 'Business',
    items: [
      { slug: 'location',          label: 'Location',
        keywords: ['state', 'address', 'service area', 'recording disclosure', 'two-party consent'] },
      { slug: 'trades',            label: 'Trades',
        keywords: ['hvac', 'plumbing', 'roofing', 'electrical', 'industry', 'business type'] },
      { slug: 'hours',             label: 'Hours',
        keywords: ['business hours', 'open', 'close', 'timezone', 'holidays'] },
      { slug: 'services',          label: 'Services & pricing',
        keywords: ['catalog', 'service list', 'pricing', 'quote required'] },
      { slug: 'schedule',          label: 'Schedule',
        keywords: ['calendar view', 'week start', 'time range'] },
      { slug: 'team',              label: 'Team',
        keywords: ['operators', 'tech', 'csr', 'manager', 'staff'] },
    ],
  },
  {
    label: 'Receptionist',
    items: [
      { slug: 'voice',             label: 'Voice & persona',
        keywords: ['agent name', 'greeting', 'first message', 'tone', 'voice speed', 'recording', 'system prompt', 'temperature'] },
      { slug: 'role',              label: 'Role & capabilities',
        keywords: ['booking', 'messaging', 'faq', 'what the agent can do'] },
      { slug: 'on-call',           label: 'On-call number',
        keywords: ['transfer', 'live transfer', 'phone', 'oncall', 'after hours number'] },
      { slug: 'escalation',        label: 'Escalation',
        keywords: ['speak to human', 'representative', 'emergency', 'route to person'] },
      { slug: 'after-hours',       label: 'After-hours',
        keywords: ['outside business hours', 'voicemail', 'message only'], comingSoon: true },
    ],
  },
  {
    label: 'Connections',
    items: [
      { slug: 'phone-number',      label: 'Echon phone number',
        keywords: ['vapi number', 'twilio', 'area code', 'forwarding'] },
      { slug: 'calendar',          label: 'Calendar',
        keywords: ['google calendar', 'outlook', 'gcal'], comingSoon: true },
      { slug: 'other-integrations',label: 'Other integrations',
        keywords: ['jobber', 'housecall pro', 'servicetitan', 'crm'], comingSoon: true },
    ],
  },
  {
    label: 'Billing',
    items: [
      { slug: 'plan',              label: 'Plan & payment',
        keywords: ['subscription', 'invoice', 'card'], comingSoon: true },
    ],
  },
] as const

export type SettingsSectionSlug =
  | 'profile' | 'notifications'
  | 'location' | 'trades' | 'hours' | 'services' | 'schedule' | 'team'
  | 'voice' | 'role' | 'on-call' | 'after-hours' | 'escalation'
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

// Single source of truth for "contact support" copy.
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
