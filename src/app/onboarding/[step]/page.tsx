import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StepClientPieces } from '../_components/StepClientPieces'
import { Step1Welcome } from '../_steps/Step1Welcome'
import { Step2Referral } from '../_steps/Step2Referral'
import { Step3BusinessType } from '../_steps/Step3BusinessType'
import { Step4BusinessInfo } from '../_steps/Step4BusinessInfo'
import { Step5Services } from '../_steps/Step5Services'
import { Step6Hours, type WeekHours } from '../_steps/Step6Hours'
import { Step7AfterHours } from '../_steps/Step7AfterHours'
import { Step8QuoteRules } from '../_steps/Step8QuoteRules'
import { Step9BuildAgent } from '../_steps/Step9BuildAgent'
import { Step10Calendar } from '../_steps/Step10Calendar'
import { Step11NumberProvisioning } from '../_steps/Step11NumberProvisioning'
import { Step12AllSet } from '../_steps/Step12AllSet'
import {
  CONFETTI_STEPS,
  isValidStep,
  getServiceCatalog,
} from '../_constants'
import type { BusinessType } from '../_constants'

type Props = {
  params: Promise<{ step: string }>
}

const cardClass =
  'rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900'

export default async function StepPage({ params }: Props) {
  const { step } = await params
  const n = Number(step)
  if (!isValidStep(n)) notFound()

  const showConfetti = CONFETTI_STEPS.has(n)

  // Every step now has a real component (Steps 1-12).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <>
      <div className={cardClass}>
        {await renderStep(n, user.id)}
        <StepClientPieces showConfetti={showConfetti} />
      </div>
      <BackLink step={n} />
    </>
  )
}

// ---------------------------------------------------------------------------
// BackLink — "← Previous step" rendered below the card. Hidden on Step 1.
// Middleware allows backwards navigation; the user can revisit completed
// steps to edit answers without losing progress.
// ---------------------------------------------------------------------------

function BackLink({ step }: { step: number }) {
  if (step <= 1) return null
  return (
    <div className="mt-4 flex justify-center">
      <Link
        href={`/onboarding/${step - 1}`}
        className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
      >
        ← Previous step
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// renderStep — fetches per-step server data and returns the right component.
// Kept inline because each step has different defaults to hydrate.
// ---------------------------------------------------------------------------

async function renderStep(n: number, userId: string) {
  const supabase = await createClient()

  if (n === 1) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', userId)
      .single()
    return <Step1Welcome firstName={profile?.first_name ?? ''} />
  }

  if (n === 2) {
    return <Step2Referral />
  }

  if (n === 3) {
    const { data: ws } = await supabase
      .from('workspaces')
      .select('business_type, business_type_other')
      .eq('owner_id', userId)
      .single()
    return (
      <Step3BusinessType
        defaults={{
          business_type: ws?.business_type ?? '',
          business_type_other: ws?.business_type_other ?? '',
        }}
      />
    )
  }

  // Steps 4-9 read from agent_configs for resume/edit defaults. Step 5 also
  // needs the workspace's business_type to pick the right service catalog.
  const [{ data: cfg }, { data: ws }] = await Promise.all([
    supabase
      .from('agent_configs')
      .select(
        'business_name, business_phone, business_address, service_area, services, business_hours, timezone, after_hours_mode, oncall_numbers, quote_rule_replacement, quote_rule_commercial, quote_rule_insurance, quote_rule_custom, tasks, tasks_other, typical_callers, typical_callers_other, tone, tone_other, voice_preset, agent_name, builder_substep',
      )
      .single(),
    supabase
      .from('workspaces')
      .select('business_type')
      .eq('owner_id', userId)
      .single<{ business_type: BusinessType | null }>(),
  ])

  if (n === 4) {
    return (
      <Step4BusinessInfo
        defaults={{
          business_name:    cfg?.business_name ?? '',
          business_phone:   cfg?.business_phone ?? '',
          business_address: cfg?.business_address ?? '',
          service_area:
            cfg?.service_area && typeof cfg.service_area === 'object' && 'freeform' in cfg.service_area
              ? String((cfg.service_area as { freeform: string }).freeform)
              : '',
        }}
      />
    )
  }

  if (n === 5) {
    const businessType = ws?.business_type ?? null
    const catalog = getServiceCatalog(businessType)
    const services = Array.isArray(cfg?.services)
      ? (cfg!.services as Array<{ key?: string; label?: string }>)
      : []
    const selected = services.map((s) => s.key).filter((k): k is string => Boolean(k))
    const freeText = businessType === 'other'
      ? services.map((s) => s.label ?? '').filter(Boolean).join('\n')
      : ''
    return (
      <Step5Services
        businessType={businessType}
        catalog={catalog}
        defaults={{ selected, freeText }}
      />
    )
  }

  if (n === 6) {
    return (
      <Step6Hours
        defaults={{
          hours: (cfg?.business_hours as WeekHours | undefined) ?? undefined,
          timezone: cfg?.timezone ?? undefined,
        }}
      />
    )
  }
  if (n === 7) return <Step7AfterHours />
  if (n === 8) return <Step8QuoteRules />

  if (n === 9) {
    type Tone = 'professional' | 'friendly' | 'empathetic' | 'concise' | 'other'
    return (
      <Step9BuildAgent
        defaults={{
          tasks:
            Array.isArray(cfg?.tasks) ? (cfg!.tasks as string[]) : undefined,
          tasks_other: cfg?.tasks_other ?? undefined,
          typical_callers:
            Array.isArray(cfg?.typical_callers) ? (cfg!.typical_callers as string[]) : undefined,
          typical_callers_other: cfg?.typical_callers_other ?? undefined,
          tone: (cfg?.tone as Tone | undefined) ?? undefined,
          tone_other: cfg?.tone_other ?? undefined,
          business_name: cfg?.business_name ?? undefined,
          builder_substep: cfg?.builder_substep ?? undefined,
        }}
      />
    )
  }

  if (n === 10) return <Step10Calendar />
  if (n === 11) {
    const { data: ws } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', userId)
      .single()
    const { data: cfg } = ws
      ? await supabase
          .from('agent_configs')
          .select('business_phone, business_address')
          .eq('workspace_id', ws.id)
          .single()
      : { data: null }
    const { suggestAreaCode } = await import('@/lib/voice/area-code')
    const suggestion = suggestAreaCode({
      phone: cfg?.business_phone,
      address: cfg?.business_address,
    })
    return <Step11NumberProvisioning suggestion={suggestion} />
  }

  if (n === 12) return <Step12AllSet />

  return null
}
