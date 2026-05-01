'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TOTAL_STEPS, isValidStep, OVERLAY_MESSAGES } from './_constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StepResult =
  | { ok: true; nextStep: number; message: string }
  | { ok: false; errors: Record<string, string[]> }

// ---------------------------------------------------------------------------
// saveAndAdvance — used by client-form steps that want the overlay UX.
// Currently only Step 1 (Welcome — no data to save). Phase 5 adds per-step
// validation + writes for Steps 3-11 inside the switch below.
// ---------------------------------------------------------------------------

export async function saveAndAdvance(
  _prev: StepResult | null,
  formData: FormData,
): Promise<StepResult> {
  const step = Number(formData.get('step'))

  if (!isValidStep(step)) {
    return { ok: false, errors: { _: ['Invalid step.'] } }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, errors: { _: ['Session expired. Please refresh.'] } }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, onboarding_step')
    .eq('owner_id', user.id)
    .single()

  if (!workspace) return { ok: false, errors: { _: ['Workspace not found.'] } }
  if (step > workspace.onboarding_step) {
    return { ok: false, errors: { _: ['Step not yet reached.'] } }
  }

  // Step-specific validation + save lands here in Phase 5.
  // Step 1 is welcome-only — nothing to save.

  // Advance the cursor when completing the current step
  if (step === workspace.onboarding_step) {
    await supabase
      .from('workspaces')
      .update({ onboarding_step: step + 1 })
      .eq('id', workspace.id)
    revalidatePath('/onboarding', 'layout')
  }

  return {
    ok: true,
    nextStep: step + 1,
    message: OVERLAY_MESSAGES[step] ?? 'Done.',
  }
}

// ---------------------------------------------------------------------------
// advanceStep — used by placeholder steps (no overlay; direct redirect).
// Invariants enforced here (defense in depth against hidden-input tampering):
//   - currentStep is valid (1..TOTAL_STEPS)
//   - currentStep <= workspaces.onboarding_step
//   - Only bumps the cursor when currentStep === workspaces.onboarding_step
//   - Final step completion sets workspace_settings.onboarding_completed = true
// ---------------------------------------------------------------------------

export async function advanceStep(formData: FormData): Promise<void> {
  const currentStep = Number(formData.get('step'))

  if (!isValidStep(currentStep)) {
    throw new Error(`Invalid onboarding step: ${formData.get('step')}`)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, onboarding_step')
    .eq('owner_id', user.id)
    .single()

  if (!workspace) throw new Error('Workspace not found for authenticated user')

  if (currentStep > workspace.onboarding_step) {
    redirect(`/onboarding/${workspace.onboarding_step}`)
  }

  if (currentStep === TOTAL_STEPS) {
    if (workspace.onboarding_step < TOTAL_STEPS) {
      redirect(`/onboarding/${workspace.onboarding_step}`)
    }

    await supabase
      .from('workspace_settings')
      .update({ onboarding_completed: true })
      .eq('workspace_id', workspace.id)

    revalidatePath('/', 'layout')
    redirect('/dashboard')
  }

  if (currentStep === workspace.onboarding_step) {
    await supabase
      .from('workspaces')
      .update({ onboarding_step: currentStep + 1 })
      .eq('id', workspace.id)
    revalidatePath('/onboarding', 'layout')
  }

  redirect(`/onboarding/${currentStep + 1}`)
}
