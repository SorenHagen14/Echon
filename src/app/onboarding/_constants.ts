// Single source of truth for onboarding step metadata.
// Matches _wireframes/onboarding.md (v2 — 12 steps after the business-type
// step was inserted in migration 006). Account creation lives outside the
// wizard. The in-browser test merges into the Step 9 sub-flow.

export const TOTAL_STEPS = 12

// ---------------------------------------------------------------------------
// Test mode — loosens validation while developing the onboarding flow.
// In dev, every "required" field becomes optional so we can click through
// without filling everything in. Production keeps strict validation.
// ---------------------------------------------------------------------------

export const TEST_MODE = process.env.NODE_ENV !== 'production'

export const STEP_LABELS: readonly string[] = [
  'Welcome',                      // 1
  'Where did you hear about us?', // 2
  'What kind of business?',       // 3
  'Business info',                // 4
  'Services offered',             // 5
  'Business hours',               // 6
  'After-hours behavior',         // 7
  'Quote rules',                  // 8
  'Build your agent',             // 9 (sub-flow with side panel + in-browser test)
  'Calendar connect',             // 10
  'Number provisioning',          // 11
  "You're all set",               // 12
]

// Confetti fires on load of the step AFTER each milestone, plus on the
// finale. The Step 9 in-browser-test confetti fires inside that step's
// sub-flow (handled by the Step 9 client component, not by this set).
//   - Load of Step 6 (services configured)
//   - Load of Step 12 (finale)
export const CONFETTI_STEPS: ReadonlySet<number> = new Set([6, 12])

// Steps that render a "Skip" button in addition to Continue.
//   - Step 10: Calendar connect (skippable, "Highly recommended")
export const SKIPPABLE_STEPS: ReadonlySet<number> = new Set([10])

export function labelForStep(step: number): string {
  return STEP_LABELS[step - 1] ?? 'Unknown step'
}

export function isValidStep(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= TOTAL_STEPS
}

// ---------------------------------------------------------------------------
// Overlay microcopy.
// Disabled — the user prefers direct navigation between steps. StepShell
// already skips the overlay when message is empty, so leaving these maps
// empty is enough to remove all between-step popups. Re-add per-step entries
// here to bring an overlay back for that specific step.
// ---------------------------------------------------------------------------

export const OVERLAY_MESSAGES: Readonly<Record<number, string>> = {}

export const OVERLAY_MESSAGES_SKIP: Readonly<Record<number, string>> = {}

// ---------------------------------------------------------------------------
// Step 2 — Referral source options. Mirrors the workspaces.referral_source
// enum in migration 005. Keep in sync with the DB enum.
// ---------------------------------------------------------------------------

export const REFERRAL_SOURCE_OPTIONS = [
  { value: 'google_search', label: 'Google Search' },
  { value: 'youtube',       label: 'YouTube' },
  { value: 'linkedin',      label: 'LinkedIn' },
  { value: 'twitter',       label: 'Twitter' },
  { value: 'blog',          label: 'Blog' },
  { value: 'discord',       label: 'Discord' },
  { value: 'friend',        label: 'Friend' },
  { value: 'other',         label: 'Other' },
] as const

export type ReferralSource = typeof REFERRAL_SOURCE_OPTIONS[number]['value']

// ---------------------------------------------------------------------------
// Step 3 — Business type options. Mirrors the workspaces.business_type
// enum in migration 006. Keep in sync with the DB enum.
//
// Marketing is HVAC-only at launch — the other types exist to seed the
// "narrow-then-wide" infrastructure so future verticals don't need a
// schema change. Service catalogs / vertical-specific UX live elsewhere
// and will be added per vertical when each one is rolled out.
// ---------------------------------------------------------------------------

export const BUSINESS_TYPE_OPTIONS = [
  { value: 'hvac',               label: 'HVAC' },
  { value: 'plumbing',           label: 'Plumbing' },
  { value: 'roofing',            label: 'Roofing' },
  { value: 'electrical',         label: 'Electrical' },
  { value: 'deck_fence',         label: 'Deck / Fence' },
  { value: 'landscaping',        label: 'Landscaping' },
  { value: 'general_contractor', label: 'General contractor' },
  { value: 'other',              label: 'Other' },
] as const

export type BusinessType = typeof BUSINESS_TYPE_OPTIONS[number]['value']

// ---------------------------------------------------------------------------
// Step 5 — Per-vertical service catalogs.
// Lives here (not in actions.ts) because actions.ts is a 'use server' file
// and can only export async functions.
//
// Step 5 looks up the catalog for the user's business_type from Step 3.
// 'other' has no preset catalog — the UI renders a free-text "list your
// services" path instead.
// ---------------------------------------------------------------------------

export type ServiceOption = { key: string; label: string }

export const SERVICE_CATALOGS: Readonly<Record<BusinessType, readonly ServiceOption[]>> = {
  hvac: [
    { key: 'ac_repair',          label: 'AC repair' },
    { key: 'ac_install',         label: 'AC install' },
    { key: 'ac_maintenance',     label: 'AC maintenance' },
    { key: 'furnace_repair',     label: 'Furnace repair' },
    { key: 'furnace_install',    label: 'Furnace install' },
    { key: 'furnace_maint',      label: 'Furnace maintenance' },
    { key: 'heat_pump',          label: 'Heat pump' },
    { key: 'mini_split',         label: 'Mini-split / ductless' },
    { key: 'iaq',                label: 'Indoor air quality' },
    { key: 'duct_cleaning',      label: 'Duct cleaning' },
    { key: 'thermostat_install', label: 'Thermostat install' },
    { key: 'commercial',         label: 'Commercial HVAC' },
  ],
  plumbing: [
    { key: 'drain_cleaning',     label: 'Drain cleaning' },
    { key: 'leak_repair',        label: 'Leak repair' },
    { key: 'water_heater_repair',label: 'Water heater repair' },
    { key: 'water_heater_install',label:'Water heater install' },
    { key: 'toilet',             label: 'Toilet repair / install' },
    { key: 'faucet',             label: 'Faucet repair / install' },
    { key: 'sewer_line',         label: 'Sewer line' },
    { key: 'garbage_disposal',   label: 'Garbage disposal' },
    { key: 'pipe_repair',        label: 'Pipe repair' },
    { key: 'sump_pump',          label: 'Sump pump' },
    { key: 're_piping',          label: 'Re-piping' },
    { key: 'commercial',         label: 'Commercial plumbing' },
  ],
  roofing: [
    { key: 'roof_repair',        label: 'Roof repair' },
    { key: 'roof_replacement',   label: 'Roof replacement' },
    { key: 'inspection',         label: 'Roof inspection' },
    { key: 'storm_damage',       label: 'Storm damage' },
    { key: 'gutter',             label: 'Gutter repair / install' },
    { key: 'skylight',           label: 'Skylight install / repair' },
    { key: 'flat_roof',          label: 'Flat roof' },
    { key: 'tile_roof',          label: 'Tile roof' },
    { key: 'metal_roof',         label: 'Metal roof' },
    { key: 'commercial',         label: 'Commercial roofing' },
  ],
  electrical: [
    { key: 'outlet_switch',      label: 'Outlet / switch install' },
    { key: 'panel_upgrade',      label: 'Panel upgrade' },
    { key: 'lighting',           label: 'Lighting install' },
    { key: 'ceiling_fan',        label: 'Ceiling fan install' },
    { key: 'ev_charger',         label: 'EV charger install' },
    { key: 'generator',          label: 'Generator install' },
    { key: 'wiring_repair',      label: 'Wiring repair' },
    { key: 'inspection',         label: 'Electrical inspection' },
    { key: 'smoke_detector',     label: 'Smoke / CO detector' },
    { key: 'surge_protection',   label: 'Surge protection' },
    { key: 'commercial',         label: 'Commercial electrical' },
  ],
  deck_fence: [
    { key: 'new_deck',           label: 'New deck' },
    { key: 'deck_repair',        label: 'Deck repair' },
    { key: 'deck_staining',      label: 'Deck staining / sealing' },
    { key: 'new_fence_wood',     label: 'New wood fence' },
    { key: 'new_fence_vinyl',    label: 'New vinyl fence' },
    { key: 'new_fence_chain',    label: 'New chain-link fence' },
    { key: 'new_fence_aluminum', label: 'New aluminum fence' },
    { key: 'fence_repair',       label: 'Fence repair' },
    { key: 'gate_install',       label: 'Gate install' },
    { key: 'pergola',            label: 'Pergola' },
    { key: 'privacy_screens',    label: 'Privacy screens' },
  ],
  landscaping: [
    { key: 'mowing',             label: 'Mowing' },
    { key: 'trimming_edging',    label: 'Trimming / edging' },
    { key: 'tree_pruning',       label: 'Tree pruning' },
    { key: 'tree_removal',       label: 'Tree removal' },
    { key: 'mulching',           label: 'Mulching' },
    { key: 'flower_bed',         label: 'Flower bed install' },
    { key: 'sod',                label: 'Sod install' },
    { key: 'aeration',           label: 'Aeration' },
    { key: 'fertilization',      label: 'Fertilization' },
    { key: 'irrigation',         label: 'Irrigation install / repair' },
    { key: 'snow_removal',       label: 'Snow removal' },
    { key: 'cleanups',           label: 'Spring / fall cleanup' },
  ],
  general_contractor: [
    { key: 'kitchen_remodel',    label: 'Kitchen remodel' },
    { key: 'bathroom_remodel',   label: 'Bathroom remodel' },
    { key: 'basement_finish',    label: 'Basement finishing' },
    { key: 'additions',          label: 'Additions' },
    { key: 'flooring',           label: 'Flooring' },
    { key: 'drywall',            label: 'Drywall' },
    { key: 'painting',           label: 'Painting' },
    { key: 'cabinet_install',    label: 'Cabinet install' },
    { key: 'tile_install',       label: 'Tile install' },
    { key: 'window_install',     label: 'Window install' },
    { key: 'door_install',       label: 'Door install' },
    { key: 'demolition',         label: 'Demolition' },
  ],
  // 'other' has no preset catalog — Step 5 renders a free-text path.
  other: [],
}

export function getServiceCatalog(type: BusinessType | null | undefined): readonly ServiceOption[] {
  if (!type) return SERVICE_CATALOGS.hvac
  return SERVICE_CATALOGS[type] ?? SERVICE_CATALOGS.hvac
}

// ---------------------------------------------------------------------------
// Step 9 — Build your agent. Sub-flow option lists. Shape mirrors the
// agent_configs columns added in migration 005:
//   * tasks            (jsonb array of TASK_OPTION keys + optional 'other')
//   * typical_callers  (jsonb array of CALLER_OPTION keys + optional 'other')
//   * tone             (enum: professional | friendly | empathetic | concise | other)
//   * voice_preset     (text — Vapi voice id; placeholder list until Phase 4)
// ---------------------------------------------------------------------------

export const TASK_OPTIONS = [
  {
    key: 'take_messages',
    label: 'Take messages',
    recommended: true,
    description: 'Collects name, reason for calling, and callback number so a real person can follow up.',
  },
  {
    key: 'schedule_appointments',
    label: 'Schedule appointments',
    description: 'Answers calls, checks availability, and books service visits.',
  },
  {
    key: 'answer_faqs',
    label: 'Answer FAQs',
    description: 'Responds to common questions about your business (hours, location, pricing).',
  },
  {
    key: 'route_calls',
    label: 'Route calls',
    description: 'Greets callers and transfers urgent calls to on-call.',
  },
] as const

export const CALLER_OPTIONS = [
  { key: 'new_customers',      label: 'New customers' },
  { key: 'existing_customers', label: 'Existing customers' },
  { key: 'commercial',         label: 'Property managers / commercial accounts' },
] as const

export const TONE_OPTIONS = [
  {
    key: 'professional',
    label: 'Professional',
    description: 'Polished and respectful. Default for most shops.',
  },
  {
    key: 'friendly',
    label: 'Friendly',
    description: 'Warm and conversational. Good for residential service.',
  },
  {
    key: 'empathetic',
    label: 'Empathetic',
    description: 'Patient and reassuring. Good for emergency calls.',
  },
  {
    key: 'concise',
    label: 'Concise',
    description: 'Direct, no small talk. Good for high-volume shops.',
  },
] as const

// Voice and agent_name are not asked in onboarding — agent_name defaults
// to 'John' (set by migration 005); voice_preset is picked by the Vapi
// adapter when the assistant is provisioned in Phase 4. The user can
// change both later in Settings → Voice agent.
export const AGENT_BUILDER_TOTAL_SUBSTEPS = 4
