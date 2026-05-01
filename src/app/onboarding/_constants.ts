// Single source of truth for onboarding step metadata.
// Labels are verbatim from _wireframes/onboarding.md Flow Overview.

export const TOTAL_STEPS = 12

export const STEP_LABELS: readonly string[] = [
  'Welcome',                  // 1
  'Account creation',         // 2
  'Business info',            // 3
  'Services offered',         // 4
  'Business hours',           // 5
  'After-hours behavior',     // 6
  'Quote rules',              // 7
  'Voice agent persona',      // 8
  'Calendar connect',         // 9
  'Number provisioning',      // 10
  'Test call',                // 11
  "You're all set",           // 12
]

// Confetti fires on load of the step AFTER each milestone:
//   - "After Step 4 (services configured)"   → load of Step 5
//   - "After Step 11 (first test call)"      → load of Step 12
//   - "Step 12 on load (finale)"             → also Step 12
// Step 12 covers both the test-call celebration and the finale.
export const CONFETTI_STEPS: ReadonlySet<number> = new Set([5, 12])

// Steps that render a "Skip" button in addition to Continue.
//   - Step 9: Calendar connect (wireframe: "I'll connect later")
export const SKIPPABLE_STEPS: ReadonlySet<number> = new Set([9])

export function labelForStep(step: number): string {
  return STEP_LABELS[step - 1] ?? 'Unknown step'
}

export function isValidStep(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= TOTAL_STEPS
}

// ---------------------------------------------------------------------------
// Overlay microcopy (per wireframe Microcopy Overlays table)
// ---------------------------------------------------------------------------

export const OVERLAY_MESSAGES: Readonly<Record<number, string>> = {
  1: 'Welcome aboard.',
  2: 'Account created.',
  3: 'Got it — we know your business.',
  4: 'Services locked in.',
  5: 'Hours saved.',
  6: 'After-hours configured.',
  7: 'Quote logic set.',
  8: 'Your AI has a voice.',
  9: 'Calendar synced.',
  10: 'Your new number is live.',
  11: 'Your AI just took a real call.',
}

export const OVERLAY_MESSAGES_SKIP: Readonly<Record<number, string>> = {
  9: 'Connect later in Settings.',
}
