'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { TOTAL_STEPS, TEST_MODE, isValidStep, OVERLAY_MESSAGES, getServiceCatalog } from './_constants'
import type { BusinessType } from './_constants'
import { syncVapiAssistant } from './_voice-sync'
import { voice } from '@/lib/voice'
import { suggestAreaCode, type AreaCodeSuggestion } from '@/lib/voice/area-code'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StepResult =
  | { ok: true; nextStep: number; message: string }
  | { ok: false; errors: Record<string, string[]> }

// ---------------------------------------------------------------------------
// Per-step Zod schemas
// ---------------------------------------------------------------------------

// In TEST_MODE (dev), every "required" rule below is relaxed so we can
// click through the wizard without filling out every field. Production
// keeps strict validation. The flag is centralized in _constants.ts.

// Step 2 — Where did you hear about us?
const referralSourceEnum = z.enum([
  'google_search', 'youtube', 'linkedin', 'twitter',
  'blog', 'discord', 'friend', 'other',
])

const Step2Schema = z.object({
  referral_source: TEST_MODE ? referralSourceEnum.optional() : referralSourceEnum,
  referral_source_other: z.string().trim().max(200).optional(),
}).refine(
  (d) => TEST_MODE || d.referral_source !== 'other' || (d.referral_source_other && d.referral_source_other.length > 0),
  { message: 'Please tell us where you heard about us.', path: ['referral_source_other'] },
)

// Step 3 — What kind of business?
const businessTypeEnum = z.enum([
  'hvac', 'plumbing', 'roofing', 'electrical',
  'deck_fence', 'landscaping', 'general_contractor', 'other',
])

const Step3Schema = z.object({
  business_type: TEST_MODE ? businessTypeEnum.optional() : businessTypeEnum,
  business_type_other: z.string().trim().max(100).optional(),
}).refine(
  (d) => TEST_MODE || d.business_type !== 'other' || (d.business_type_other && d.business_type_other.length > 0),
  { message: 'Tell us what kind of business you run.', path: ['business_type_other'] },
)

// Step 4 — Business info
const Step4Schema = z.object({
  business_name: TEST_MODE
    ? z.string().trim().max(100).optional().or(z.literal(''))
    : z.string().trim().min(1, 'Business name is required.').max(100),
  business_phone: z.string().trim().max(30).optional().or(z.literal('')),
  business_address: z.string().trim().max(300).optional().or(z.literal('')),
  service_area: z.string().trim().max(300).optional().or(z.literal('')), // freeform for MVP
})

// Step 5 — Services offered. Two shapes depending on business_type:
//   * Vertical with a catalog (HVAC, plumbing, etc.) → comma-separated keys
//     from a hidden input ("services_keys")
//   * 'other' → free-text textarea with one service per line
//     ("services_freetext")
// Validation is dispatched at runtime in the action below, since which
// schema applies depends on the workspace's business_type.
const Step5KeysSchema = z.object({
  services_keys: z.string(),
}).refine(
  (d) => TEST_MODE || d.services_keys.split(',').filter(Boolean).length > 0,
  { message: 'Pick at least one service.', path: ['services_keys'] },
)

const Step5FreeTextSchema = z.object({
  services_freetext: TEST_MODE
    ? z.string().trim().max(2000)
    : z.string().trim().min(1, 'List at least one service.').max(2000),
})

// Step 6 — Business hours. MVP: one open + close per day; closed checkbox.
// Form sends a JSON string (built by the client) to keep the schema simple.
const HoursSchema = z.object({
  mon: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
  tue: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
  wed: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
  thu: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
  fri: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
  sat: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
  sun: z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
})

const Step6Schema = z.object({
  business_hours_json: z.string(),
  timezone: TEST_MODE
    ? z.string().trim().max(64).optional().or(z.literal(''))
    : z.string().trim().min(1).max(64),
})

// Step 7 — After-hours behavior. UI exposes only messages_only + escalate;
// the underlying enum still has 'live_transfer' (added in pivot migration
// 004) but it's not selectable from onboarding.
const afterHoursEnum = z.enum(['messages_only', 'escalate'])
const Step7Schema = z.object({
  after_hours_mode: TEST_MODE ? afterHoursEnum.optional() : afterHoursEnum,
  oncall_phone: z.string().trim().max(30).optional().or(z.literal('')),
}).refine(
  (d) => TEST_MODE || d.after_hours_mode === 'messages_only' || (d.oncall_phone && d.oncall_phone.length > 0),
  { message: 'On-call number is required for escalate.', path: ['oncall_phone'] },
)

// Step 8 — Quote rules
const Step8Schema = z.object({
  quote_rule_replacement: z.coerce.boolean(),
  quote_rule_commercial:  z.coerce.boolean(),
  quote_rule_insurance:   z.coerce.boolean(),
  quote_rule_custom:      z.string().trim().max(500).optional().or(z.literal('')),
})

// ---------------------------------------------------------------------------
// saveAndAdvance — used by every onboarding step. Validates per-step input,
// writes to the right table, advances the cursor, returns a StepResult that
// the client (StepShell) uses to show the microcopy overlay and navigate.
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

  // -------------------------------------------------------------------------
  // Per-step validation + DB write
  // -------------------------------------------------------------------------
  // Defensive: ensure the agent_configs row exists. The handle_new_workspace
  // trigger should provision it at signup, but for workspaces created before
  // migration 004 (or if the trigger silently failed) there's nothing to
  // .update() against and writes would no-op without an error.
  if (step >= 4) {
    await supabase
      .from('agent_configs')
      .upsert({ workspace_id: workspace.id }, { onConflict: 'workspace_id', ignoreDuplicates: true })
  }

  const writeError = await writeStepData(supabase, workspace.id, step, formData)
  if (writeError) return writeError

  // Steps 4-8 write to agent_configs and shape the assistant. Sync to Vapi
  // so by the Step 9 in-browser test the assistant matches the user's
  // current answers. Soft-fails inside the helper.
  if (step >= 4 && step <= 8) {
    await syncVapiAssistant(supabase, workspace.id)
  }

  // Advance the cursor when completing the current step
  if (step === workspace.onboarding_step) {
    const { error: cursorError } = await supabase
      .from('workspaces')
      .update({ onboarding_step: step + 1 })
      .eq('id', workspace.id)
    if (cursorError) {
      console.error('[onboarding.saveAndAdvance] cursor update failed', cursorError)
      return { ok: false, errors: { _: [cursorError.message] } }
    }
    revalidatePath('/onboarding', 'layout')
  }

  return {
    ok: true,
    nextStep: step + 1,
    message: OVERLAY_MESSAGES[step] ?? '',
  }
}

// ---------------------------------------------------------------------------
// writeStepData — dispatches to the right per-step writer. Returns a
// StepResult on validation/write failure, null on success.
// ---------------------------------------------------------------------------
type Supa = Awaited<ReturnType<typeof createClient>>

async function writeStepData(
  supabase: Supa,
  workspaceId: string,
  step: number,
  formData: FormData,
): Promise<StepResult | null> {
  switch (step) {
    case 1:
      // Welcome — no data to save.
      return null

    case 2: {
      const parsed = Step2Schema.safeParse({
        referral_source: formData.get('referral_source'),
        referral_source_other: formData.get('referral_source_other')?.toString() || undefined,
      })
      if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors }

      const { error } = await supabase
        .from('workspaces')
        .update({
          referral_source: parsed.data.referral_source,
          referral_source_other:
            parsed.data.referral_source === 'other' ? parsed.data.referral_source_other : null,
        })
        .eq('id', workspaceId)
      if (error) return { ok: false, errors: { _: [error.message] } }
      return null
    }

    case 3: {
      const parsed = Step3Schema.safeParse({
        business_type: formData.get('business_type'),
        business_type_other: formData.get('business_type_other')?.toString() || undefined,
      })
      if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors }

      const { error } = await supabase
        .from('workspaces')
        .update({
          business_type: parsed.data.business_type,
          business_type_other:
            parsed.data.business_type === 'other' ? parsed.data.business_type_other : null,
        })
        .eq('id', workspaceId)
      if (error) return { ok: false, errors: { _: [error.message] } }
      return null
    }

    case 4: {
      const parsed = Step4Schema.safeParse(Object.fromEntries(formData))
      if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors }

      console.log('[step4] writing business_name:', JSON.stringify(parsed.data.business_name))

      const { data: updated, error } = await supabase
        .from('agent_configs')
        .update({
          business_name:    parsed.data.business_name,
          business_phone:   parsed.data.business_phone || null,
          business_address: parsed.data.business_address || null,
          service_area:     parsed.data.service_area
            ? { freeform: parsed.data.service_area }
            : null,
        })
        .eq('workspace_id', workspaceId)
        .select('id, business_name')
      if (error) {
        console.error('[step4] update failed', error)
        return { ok: false, errors: { _: [error.message] } }
      }
      console.log('[step4] update result rows:', updated?.length, 'data:', updated)
      return null
    }

    case 5: {
      // Look up the user's business_type so we can validate against the
      // matching catalog (or fall through to the free-text path for 'other').
      const { data: ws } = await supabase
        .from('workspaces')
        .select('business_type')
        .eq('id', workspaceId)
        .single<{ business_type: BusinessType | null }>()

      const businessType = ws?.business_type ?? null
      const isOther = businessType === 'other'

      if (isOther) {
        const parsed = Step5FreeTextSchema.safeParse({
          services_freetext: formData.get('services_freetext') ?? '',
        })
        if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors }

        // Each non-empty line becomes a service entry. Slugify the label
        // so the key is stable for downstream lookups.
        const services = parsed.data.services_freetext
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((label) => ({
            key: label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'custom',
            label,
            book_directly: true,
            pricing_note: '',
          }))

        const { error } = await supabase
          .from('agent_configs')
          .update({ services })
          .eq('workspace_id', workspaceId)
        if (error) return { ok: false, errors: { _: [error.message] } }
        return null
      }

      const parsed = Step5KeysSchema.safeParse({ services_keys: formData.get('services_keys') ?? '' })
      if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors }

      const catalog = getServiceCatalog(businessType)
      const keys = parsed.data.services_keys.split(',').filter(Boolean)
      const services = keys
        .map((key) => catalog.find((s) => s.key === key))
        .filter((s): s is (typeof catalog)[number] => Boolean(s))
        .map((s) => ({ key: s.key, label: s.label, book_directly: true, pricing_note: '' }))

      const { error } = await supabase
        .from('agent_configs')
        .update({ services })
        .eq('workspace_id', workspaceId)
      if (error) return { ok: false, errors: { _: [error.message] } }
      return null
    }

    case 6: {
      const parsed = Step6Schema.safeParse({
        business_hours_json: formData.get('business_hours_json') ?? '',
        timezone: formData.get('timezone') ?? '',
      })
      if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors }

      let hoursObj: unknown
      try {
        hoursObj = JSON.parse(parsed.data.business_hours_json)
      } catch {
        return { ok: false, errors: { business_hours_json: ['Invalid hours format.'] } }
      }
      const hoursParsed = HoursSchema.safeParse(hoursObj)
      if (!hoursParsed.success) {
        return { ok: false, errors: { business_hours_json: ['Hours format is invalid.'] } }
      }

      const { error } = await supabase
        .from('agent_configs')
        .update({
          business_hours: hoursParsed.data,
          timezone:       parsed.data.timezone,
        })
        .eq('workspace_id', workspaceId)
      if (error) return { ok: false, errors: { _: [error.message] } }
      return null
    }

    case 7: {
      const parsed = Step7Schema.safeParse(Object.fromEntries(formData))
      if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors }

      const oncall_numbers =
        parsed.data.after_hours_mode === 'messages_only' || !parsed.data.oncall_phone
          ? []
          : [{ phone: parsed.data.oncall_phone, label: 'Primary on-call' }]

      const { error } = await supabase
        .from('agent_configs')
        .update({
          after_hours_mode: parsed.data.after_hours_mode,
          oncall_numbers,
        })
        .eq('workspace_id', workspaceId)
      if (error) return { ok: false, errors: { _: [error.message] } }
      return null
    }

    case 8: {
      const raw = Object.fromEntries(formData)
      // Checkbox inputs are absent from FormData when unchecked. Coerce
      // explicitly so missing keys become `false` instead of failing parse.
      const parsed = Step8Schema.safeParse({
        quote_rule_replacement: raw.quote_rule_replacement === 'on',
        quote_rule_commercial:  raw.quote_rule_commercial  === 'on',
        quote_rule_insurance:   raw.quote_rule_insurance   === 'on',
        quote_rule_custom:      raw.quote_rule_custom ?? '',
      })
      if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors }

      const { error } = await supabase
        .from('agent_configs')
        .update({
          quote_rule_replacement: parsed.data.quote_rule_replacement,
          quote_rule_commercial:  parsed.data.quote_rule_commercial,
          quote_rule_insurance:   parsed.data.quote_rule_insurance,
          quote_rule_custom:      parsed.data.quote_rule_custom || null,
        })
        .eq('workspace_id', workspaceId)
      if (error) return { ok: false, errors: { _: [error.message] } }
      return null
    }

    case 9:
      // Step 9 (Build your agent) data is saved sub-step-by-sub-step via
      // saveAgentBuilderSubStep. The Review's "Looks good" button calls
      // saveAndAdvance only to bump the main cursor; nothing to write here.
      return null

    default:
      // Steps 10-12 are placeholders until their own tasks land. Cursor
      // advance with no DB write is fine.
      return null
  }
}

// ---------------------------------------------------------------------------
// Step 9 — Build your agent (sub-flow). Each sub-step calls
// saveAgentBuilderSubStep with the just-completed sub-step's data. The action
// validates, writes the relevant agent_configs fields, and bumps
// agent_configs.builder_substep for resume. The main onboarding cursor is
// not advanced here — that happens when the final Review's "Looks good"
// button submits to saveAndAdvance with step=9.
// ---------------------------------------------------------------------------

// Step 9 sub-flow uses single-select for tasks + callers (the UI is radio
// buttons). The DB column is jsonb array — we wrap single values into a
// one-element array so the storage shape stays flexible for future
// multi-select if we ever want it back.
const SubTasksSchema = z.object({
  task: z.string().trim().max(64).optional().or(z.literal('')),
  tasks_other: z.string().trim().max(200).optional(),
})

const SubCallersSchema = z.object({
  typical_caller: z.string().trim().max(64).optional().or(z.literal('')),
  typical_callers_other: z.string().trim().max(200).optional(),
})

const SubToneSchema = z.object({
  tone: z.enum(['professional', 'friendly', 'empathetic', 'concise', 'other']),
  tone_other: z.string().trim().max(100).optional(),
})

export type SubStepResult =
  | { ok: true; nextSub: number }
  | { ok: false; errors: Record<string, string[]> }

export async function saveAgentBuilderSubStep(
  _prev: SubStepResult | null,
  formData: FormData,
): Promise<SubStepResult> {
  const subStep = Number(formData.get('subStep'))
  if (!Number.isInteger(subStep) || subStep < 1 || subStep > 4) {
    return { ok: false, errors: { _: ['Invalid sub-step.'] } }
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
  if (workspace.onboarding_step < 9) {
    return { ok: false, errors: { _: ['Step 9 not yet reached.'] } }
  }

  // Defensive: ensure agent_configs row exists (see saveAndAdvance for why).
  await supabase
    .from('agent_configs')
    .upsert({ workspace_id: workspace.id }, { onConflict: 'workspace_id', ignoreDuplicates: true })

  // Each sub-step writes only its own fields, plus advances builder_substep.
  // Total = 4: Tasks → Callers → Tone → Test/Review.
  const update: Record<string, unknown> = { builder_substep: Math.min(subStep + 1, 4) }

  switch (subStep) {
    case 1: {
      const parsed = SubTasksSchema.safeParse({
        task: formData.get('task')?.toString() ?? '',
        tasks_other: formData.get('tasks_other')?.toString() || undefined,
      })
      if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors }
      update.tasks = parsed.data.task ? [parsed.data.task] : []
      update.tasks_other = parsed.data.tasks_other ?? null
      break
    }
    case 2: {
      const parsed = SubCallersSchema.safeParse({
        typical_caller: formData.get('typical_caller')?.toString() ?? '',
        typical_callers_other: formData.get('typical_callers_other')?.toString() || undefined,
      })
      if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors }
      update.typical_callers = parsed.data.typical_caller ? [parsed.data.typical_caller] : []
      update.typical_callers_other = parsed.data.typical_callers_other ?? null
      break
    }
    case 3: {
      const parsed = SubToneSchema.safeParse({
        tone: formData.get('tone'),
        tone_other: formData.get('tone_other')?.toString() || undefined,
      })
      if (!parsed.success) return { ok: false, errors: z.flattenError(parsed.error).fieldErrors }
      update.tone = parsed.data.tone
      update.tone_other = parsed.data.tone === 'other' ? parsed.data.tone_other ?? null : null
      break
    }
    case 4: {
      // Sub-step 4 is the test + review screen. Nothing to save — the
      // "Looks good" CTA submits to saveAndAdvance which bumps the main
      // cursor. This branch only fires from the "Save and continue later"
      // link to persist the builder_substep cursor.
      break
    }
  }

  const { error } = await supabase
    .from('agent_configs')
    .update(update)
    .eq('workspace_id', workspace.id)
  if (error) {
    console.error('[onboarding.saveAgentBuilderSubStep] update failed', error)
    return { ok: false, errors: { _: [error.message] } }
  }

  // Sub-steps 1-3 (tasks, callers, tone) reshape the assistant. Re-sync so
  // sub-step 4's in-browser test reflects the latest answers. Sub-step 4
  // itself doesn't write agent shape, so no sync needed.
  if (subStep >= 1 && subStep <= 3) {
    await syncVapiAssistant(supabase, workspace.id)
  }

  return { ok: true, nextSub: Math.min(subStep + 1, 5) }
}

// ---------------------------------------------------------------------------
// getTestCallConfig — Step 9 sub-step 4 calls this to start the in-browser
// test. Returns the Vapi public key + the workspace's assistant id. Forces
// a fresh sync first so the assistant reflects the latest answers (covers
// the case where a soft-failed sync left things stale).
// ---------------------------------------------------------------------------

export type TestCallConfig =
  | { ok: true; publicKey: string; assistantId: string }
  | { ok: false; reason: string }

export async function getTestCallConfig(): Promise<TestCallConfig> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'Session expired. Please refresh.' }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) return { ok: false, reason: 'Workspace not found.' }

  await syncVapiAssistant(supabase, workspace.id)

  const { data: cfg, error: cfgError } = await supabase
    .from('agent_configs')
    .select('vapi_assistant_id')
    .eq('workspace_id', workspace.id)
    .single()

  console.log('[getTestCallConfig] cfg lookup — error:', cfgError, 'cfg:', cfg)

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY
  if (!publicKey) {
    console.warn('[getTestCallConfig] no public key in env')
    return { ok: false, reason: 'Vapi public key not configured.' }
  }
  if (!cfg?.vapi_assistant_id) {
    console.warn('[getTestCallConfig] vapi_assistant_id missing in cfg lookup')
    return { ok: false, reason: 'Agent not provisioned yet — try again in a moment.' }
  }

  console.log('[getTestCallConfig] returning ok with assistant', cfg.vapi_assistant_id)
  return { ok: true, publicKey, assistantId: cfg.vapi_assistant_id }
}

// ---------------------------------------------------------------------------
// Step 11 — Number provisioning actions.
// ---------------------------------------------------------------------------

export type ClaimNumberResult =
  | { ok: true; e164: string }
  | { ok: false; reason: string }

// Read business_phone + business_address off the workspace's agent_config
// and return an area-code prefill suggestion. Returns null if neither
// signal is plausible — the UI just leaves the input empty in that case.
export async function getSuggestedAreaCode(): Promise<AreaCodeSuggestion | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) return null

  const { data: cfg } = await supabase
    .from('agent_configs')
    .select('business_phone, business_address')
    .eq('workspace_id', workspace.id)
    .single()
  if (!cfg) return null

  return suggestAreaCode({ phone: cfg.business_phone, address: cfg.business_address })
}

export async function claimNumber(areaCode: string): Promise<ClaimNumberResult> {
  if (!/^\d{3}$/.test(areaCode)) {
    return { ok: false, reason: 'Area code must be 3 digits.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'Session expired. Please refresh.' }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) return { ok: false, reason: 'Workspace not found.' }

  const { data: cfg } = await supabase
    .from('agent_configs')
    .select('vapi_assistant_id')
    .eq('workspace_id', workspace.id)
    .single()

  try {
    const { vapiNumberId, e164 } = await voice.provisionNumber(areaCode)

    if (cfg?.vapi_assistant_id) {
      await voice.attachNumberToAssistant(vapiNumberId, cfg.vapi_assistant_id)
    }

    const { error } = await supabase.from('phone_numbers').insert({
      workspace_id: workspace.id,
      e164_number: e164,
      vapi_number_id: vapiNumberId,
      status: 'active',
      source: 'provisioned',
    })
    if (error) {
      console.error('[claimNumber] DB insert failed', error)
      return { ok: false, reason: error.message }
    }

    return { ok: true, e164 }
  } catch (e) {
    console.error('[claimNumber] vapi provision failed', e)
    // Vapi error bodies are JSON-stringified into our Error message —
    // try to pull out the user-facing hint if there is one.
    const msg = e instanceof Error ? e.message : String(e)
    const match = msg.match(/"message":(?:"([^"]+)"|\["([^"]+)"\])/)
    const detail = match?.[1] || match?.[2]
    return {
      ok: false,
      reason: detail || 'Could not provision number — try a different area code.',
    }
  }
}

// ---------------------------------------------------------------------------
// devSkipToDashboard — TEST_MODE only. Fast-forwards onboarding past every
// step and marks it complete so the dashboard is reachable without typing
// through the wizard. Refuses to run in production.
// ---------------------------------------------------------------------------

export async function devSkipToDashboard(): Promise<void> {
  if (!TEST_MODE) throw new Error('devSkipToDashboard is dev-only')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) throw new Error('Workspace not found')

  await supabase
    .from('workspaces')
    .update({ onboarding_step: TOTAL_STEPS })
    .eq('id', workspace.id)

  await supabase
    .from('workspace_settings')
    .update({ onboarding_completed: true })
    .eq('workspace_id', workspace.id)

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

// ---------------------------------------------------------------------------
// advanceStep — placeholder cursor-advance (no overlay; direct redirect).
// Used by Steps that don't have a real form yet (Steps 8-11 until they're
// built). Kept around as an escape hatch.
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
    const { error: updateError } = await supabase
      .from('workspaces')
      .update({ onboarding_step: currentStep + 1 })
      .eq('id', workspace.id)
    if (updateError) {
      console.error('[onboarding.advanceStep] cursor update failed', {
        currentStep,
        workspaceId: workspace.id,
        error: updateError,
      })
      throw new Error(`Failed to advance onboarding cursor: ${updateError.message}`)
    }
    revalidatePath('/onboarding', 'layout')
  }

  redirect(`/onboarding/${currentStep + 1}`)
}
