'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { anthropic, MODELS } from '@/lib/ai/anthropic'
import { fetchMergeCandidates } from './data'
import { SLOT_META, type AutoAssignReport, type AutoAssignSlotResult, type CaseSlot, type EligibleOperator } from './types'

async function requireWorkspace() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) throw new Error('Workspace not found')
  return { supabase, workspaceId: workspace.id as string }
}

const SLOT_TO_COLUMN: Record<CaseSlot, 'cs_rep_id' | 'technician_id' | 'manager_id'> = {
  cs_rep: 'cs_rep_id',
  technician: 'technician_id',
  manager: 'manager_id',
}

const VALID_SLOTS = new Set(Object.keys(SLOT_TO_COLUMN) as CaseSlot[])

function revalidateCasePaths() {
  revalidatePath('/dashboard')
  revalidatePath('/calls')
  revalidatePath('/customers')
}

// -- Case lifecycle ----------------------------------------------------------

// Returns the case_id for a call. If the call has no case yet:
//   - if the call's customer has an open case → link the call to it
//   - otherwise create a new case (status=open) and link the call
// No-ops for calls without a customer (those can never have a case).
export async function ensureCaseForCall(callId: string): Promise<string | null> {
  const { supabase, workspaceId } = await requireWorkspace()

  const { data: call } = await supabase
    .from('calls')
    .select('id, case_id, customer_id, started_at, service_requested')
    .eq('id', callId)
    .eq('workspace_id', workspaceId)
    .single()
  if (!call) return null
  if (call.case_id) return call.case_id as string
  if (!call.customer_id) return null

  // Open case for this customer?
  const { data: openCase } = await supabase
    .from('cases')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('customer_id', call.customer_id)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let caseId: string
  if (openCase) {
    caseId = openCase.id as string
  } else {
    const title = (call.service_requested as string | null) ?? null
    const { data: created, error: createErr } = await supabase
      .from('cases')
      .insert({
        workspace_id: workspaceId,
        customer_id: call.customer_id,
        status: 'open',
        title,
        opened_at: call.started_at as string,
      })
      .select('id')
      .single()
    if (createErr || !created) throw new Error(`Case create failed: ${createErr?.message ?? 'unknown'}`)
    caseId = created.id as string
  }

  await supabase.from('calls').update({ case_id: caseId }).eq('id', callId)
  // Pull any appointments booked off this call into the same case.
  await supabase.from('appointments').update({ case_id: caseId }).eq('call_id', callId).is('case_id', null)

  revalidateCasePaths()
  return caseId
}

export async function setCaseStatus(formData: FormData): Promise<void> {
  const caseId = formData.get('caseId')
  const status = formData.get('status')
  if (typeof caseId !== 'string' || !caseId) throw new Error('caseId required')
  if (status !== 'open' && status !== 'closed') throw new Error('status must be open or closed')

  const { supabase, workspaceId } = await requireWorkspace()
  const { error } = await supabase
    .from('cases')
    .update({
      status,
      closed_at: status === 'closed' ? new Date().toISOString() : null,
    })
    .eq('id', caseId)
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(`Case status update failed: ${error.message}`)
  revalidateCasePaths()
}

export async function updateCaseNotes(formData: FormData): Promise<void> {
  const caseId = formData.get('caseId')
  const notes = formData.get('notes')
  if (typeof caseId !== 'string' || !caseId) throw new Error('caseId required')
  if (typeof notes !== 'string') throw new Error('notes required')

  const { supabase, workspaceId } = await requireWorkspace()
  const { error } = await supabase
    .from('cases')
    .update({ notes: notes.trim() || null })
    .eq('id', caseId)
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(`Notes update failed: ${error.message}`)
  revalidatePath(`/cases/${caseId}`)
}

export async function updateCaseTitle(formData: FormData): Promise<void> {
  const caseId = formData.get('caseId')
  const title = formData.get('title')
  if (typeof caseId !== 'string' || !caseId) throw new Error('caseId required')
  if (typeof title !== 'string') throw new Error('title required')

  const { supabase, workspaceId } = await requireWorkspace()
  const trimmed = title.trim()
  const { error } = await supabase
    .from('cases')
    .update({ title: trimmed || null })
    .eq('id', caseId)
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(`Case title update failed: ${error.message}`)
  revalidateCasePaths()
}

// -- Slot assignment ---------------------------------------------------------

// Single-slot manual assign — driven by the dropdown on each role card.
export async function assignCaseSlot(formData: FormData): Promise<void> {
  const caseId = formData.get('caseId')
  const slot = formData.get('slot') as CaseSlot
  const operatorIdRaw = formData.get('operatorId')

  if (typeof caseId !== 'string' || !caseId) throw new Error('caseId required')
  if (!VALID_SLOTS.has(slot)) throw new Error('invalid slot')

  const operatorId =
    typeof operatorIdRaw === 'string' && operatorIdRaw.trim() ? operatorIdRaw : null

  const { supabase, workspaceId } = await requireWorkspace()
  const { error } = await supabase
    .from('cases')
    .update({ [SLOT_TO_COLUMN[slot]]: operatorId })
    .eq('id', caseId)
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(`Assign failed: ${error.message}`)
  revalidateCasePaths()
}

// -- Auto-assign (recommendation only — apply happens via confirmAutoAssign) -

// Returns recommendations without applying them. Empty slots get filled by
// rule (eligibility flag + no scheduling conflict + highest per-role
// priority). Slots that are already filled are left as-is and surfaced in
// the report so the confirm dialog can show them.
export async function recommendAutoAssign(caseId: string): Promise<AutoAssignReport> {
  const { supabase, workspaceId } = await requireWorkspace()

  const { data: caseRow } = await supabase
    .from('cases')
    .select('id, cs_rep_id, technician_id, manager_id')
    .eq('id', caseId)
    .eq('workspace_id', workspaceId)
    .single()
  if (!caseRow) throw new Error('Case not found')

  const { data: operators } = await supabase
    .from('operators')
    .select('id, name, color, is_cs_rep, is_technician, is_manager, priority_cs, priority_tech, priority_manager')
    .eq('workspace_id', workspaceId)
  const allOps = (operators ?? []) as EligibleOperator[]

  // Gather every appointment in this case, plus every appointment elsewhere
  // that could conflict — used to detect overlap.
  const { data: caseAppts } = await supabase
    .from('appointments')
    .select('id, scheduled_for, duration_min')
    .eq('workspace_id', workspaceId)
    .eq('case_id', caseId)
    .neq('status', 'canceled')

  const targetWindows = (caseAppts ?? []).map((a) => ({
    start: new Date(a.scheduled_for as string),
    end: new Date(new Date(a.scheduled_for as string).getTime() + ((a.duration_min as number | null) ?? 60) * 60_000),
  }))

  // For each operator, fetch any other appointment they're already on (via
  // their cases). If targetWindows is empty, no conflict is possible — skip
  // the lookup entirely.
  const conflicts = new Map<string, { start: Date; end: Date }[]>()
  if (targetWindows.length > 0 && allOps.length > 0) {
    const opIds = allOps.map((o) => o.id)
    const { data: otherCases } = await supabase
      .from('cases')
      .select('id, cs_rep_id, technician_id, manager_id')
      .eq('workspace_id', workspaceId)
      .neq('id', caseId)
      .or(`cs_rep_id.in.(${opIds.join(',')}),technician_id.in.(${opIds.join(',')}),manager_id.in.(${opIds.join(',')})`)
    const otherCaseIds = (otherCases ?? []).map((c) => c.id as string)
    const opsByCase = new Map<string, Set<string>>()
    for (const c of (otherCases ?? []) as { id: string; cs_rep_id: string | null; technician_id: string | null; manager_id: string | null }[]) {
      const set = new Set<string>()
      if (c.cs_rep_id) set.add(c.cs_rep_id)
      if (c.technician_id) set.add(c.technician_id)
      if (c.manager_id) set.add(c.manager_id)
      opsByCase.set(c.id, set)
    }
    if (otherCaseIds.length > 0) {
      const { data: otherAppts } = await supabase
        .from('appointments')
        .select('case_id, scheduled_for, duration_min, status')
        .eq('workspace_id', workspaceId)
        .in('case_id', otherCaseIds)
        .neq('status', 'canceled')
      for (const a of (otherAppts ?? []) as { case_id: string; scheduled_for: string; duration_min: number | null }[]) {
        const ops = opsByCase.get(a.case_id)
        if (!ops) continue
        const start = new Date(a.scheduled_for)
        const end = new Date(start.getTime() + ((a.duration_min as number | null) ?? 60) * 60_000)
        for (const opId of ops) {
          const arr = conflicts.get(opId) ?? []
          arr.push({ start, end })
          conflicts.set(opId, arr)
        }
      }
    }
  }

  function operatorHasConflict(opId: string): boolean {
    const windows = conflicts.get(opId)
    if (!windows || targetWindows.length === 0) return false
    for (const t of targetWindows) {
      for (const w of windows) {
        if (t.start < w.end && w.start < t.end) return true
      }
    }
    return false
  }

  const results: AutoAssignSlotResult[] = []

  for (const slot of ['cs_rep', 'technician', 'manager'] as CaseSlot[]) {
    const meta = SLOT_META[slot]
    const currentId =
      slot === 'cs_rep' ? caseRow.cs_rep_id :
      slot === 'technician' ? caseRow.technician_id :
      caseRow.manager_id
    if (currentId) {
      const op = allOps.find((o) => o.id === currentId)
      results.push({
        slot,
        status: 'kept',
        operatorId: currentId as string,
        operatorName: op?.name ?? 'Operator',
        operatorColor: op?.color ?? '#64748b',
        reason: 'Already assigned — left as-is.',
      })
      continue
    }

    const eligible = allOps.filter((o) => o[meta.eligibilityField])
    if (eligible.length === 0) {
      results.push({
        slot,
        status: 'unfilled',
        reason: `No team member is marked eligible as ${meta.label.toLowerCase()}. Mark someone in Settings → Team.`,
      })
      continue
    }

    const available = eligible.filter((o) => !operatorHasConflict(o.id))
    if (available.length === 0) {
      const busyNames = eligible.map((o) => o.name).join(', ')
      results.push({
        slot,
        status: 'unfilled',
        reason: `No available ${meta.label.toLowerCase()} — ${busyNames} ${eligible.length === 1 ? 'is' : 'are'} all booked during this case's appointments.`,
      })
      continue
    }

    available.sort((a, b) => (b[meta.priorityField] as number) - (a[meta.priorityField] as number))
    const pick = available[0]
    results.push({
      slot,
      status: 'recommended',
      operatorId: pick.id,
      operatorName: pick.name,
      operatorColor: pick.color,
      priority: pick[meta.priorityField] as number,
      reason: `Highest priority among ${available.length} available — score ${pick[meta.priorityField]}.`,
    })
  }

  return { results }
}

// Applies the recommendations the dialog showed. Picks ids out of FormData
// (one per slot, as `slot:<name>` keys); empty/missing keys mean "leave as
// is" so users can opt out of individual slots before confirming.
export async function confirmAutoAssign(formData: FormData): Promise<void> {
  const caseId = formData.get('caseId')
  if (typeof caseId !== 'string' || !caseId) throw new Error('caseId required')

  const updates: Record<string, string | null> = {}
  for (const slot of ['cs_rep', 'technician', 'manager'] as CaseSlot[]) {
    const raw = formData.get(`slot:${slot}`)
    if (typeof raw !== 'string') continue
    if (raw === '') continue
    if (raw === '__skip') continue
    updates[SLOT_TO_COLUMN[slot]] = raw
  }
  if (Object.keys(updates).length === 0) return

  const { supabase, workspaceId } = await requireWorkspace()
  const { error } = await supabase
    .from('cases')
    .update(updates)
    .eq('id', caseId)
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(`Auto-assign apply failed: ${error.message}`)
  revalidateCasePaths()
}

// -- Recommended action (per case) -------------------------------------------

function tradeLabel(businessType: string | null, businessTypeOther: string | null): string {
  switch (businessType) {
    case 'hvac':                return 'HVAC'
    case 'plumbing':            return 'plumbing'
    case 'roofing':             return 'roofing'
    case 'electrical':          return 'electrical'
    case 'deck_fence':          return 'deck and fence'
    case 'landscaping':         return 'landscaping'
    case 'general_contractor':  return 'general contracting'
    case 'other':               return businessTypeOther?.trim() || 'service'
    default:                    return 'service'
  }
}

function buildActionPlanSystemPrompt(trade: string): string {
  return `You are an operations assistant for a small ${trade} business. A customer called the business's AI receptionist (possibly multiple times about the same issue) and the case is unresolved. A human operator (the owner, dispatcher, or manager) is about to call the customer back. Write the briefing they need for that callback.

OUTPUT FORMAT
- 3 to 5 bullets, prefixed with "• ", plain text only.
- No headers, no preamble, no closing remarks.
- Bullet 1 is ALWAYS the conversation opener.

WHAT EACH BULLET DOES

(1) The opening line. Write the exact sentence the operator should say first, in double quotes. It must:
   - Address the customer by name.
   - Acknowledge the situation in plain language ("I understand why this is frustrating", not "I'm so sorry for the inconvenience"). No corporate apology language.
   - Lead with action ("I'm calling personally to make this right today"), not history.
   - Avoid filler phrases: "just wanted to circle back", "real quick", "touching base", "reaching out".

(2) Likely root cause. Name what you suspect using ${trade}-specific terminology — say the actual component, system, or material involved, not "the unit" or "the issue". State the reasoning in one short clause. If symptoms are ambiguous, say so and list the top 2 differentials.

(3) The concrete commitment. Exactly what the operator should commit to during the callback (e.g. "Dispatch [tech name] between 1-3pm today"; "Send a written estimate to [email] by end of day"). Avoid vague verbs like "address", "look into", "follow up on".

(4) Anticipated pushback + response. Predict the most likely customer objection and write the operator's one-sentence response. Use ${trade} economics where relevant (repair-vs-replace thresholds, parts availability, urgency tradeoffs).

(5) Concession authority — ONLY if the case warrants goodwill (return visit, prior misdiagnosis, repeated calls, missed appointment). Name the specific concession ("waive the $89 diagnostic", "credit yesterday's visit toward the repair"). If goodwill isn't warranted, omit this bullet entirely. Do not invent a reason.

DO NOT WRITE
- Generic communication advice ("show empathy", "be professional").
- Procedural notes the operator can read off the summary themselves.
- Diagnostic procedures meant for the field tech. The operator is not the tech.
- Filler bullets to hit a count. 3 strong bullets beats 5 weak ones.
- Suggestions about what to "consider" or "keep in mind" — every bullet must be an action or a sentence to say.`
}

// On-demand action-plan generator for a case. Aggregates every call's
// transcript + summary in the case (oldest first, capped) and feeds them
// to Haiku. Persists the result on `cases.recommended_action`.
export async function generateCaseRecommendedAction(caseId: string): Promise<void> {
  const { supabase, workspaceId } = await requireWorkspace()

  const { data: workspaceRow } = await supabase
    .from('workspaces')
    .select('id, business_type, business_type_other')
    .eq('id', workspaceId)
    .single()
  if (!workspaceRow) throw new Error('Workspace not found')

  const trade = tradeLabel(
    (workspaceRow.business_type as string | null) ?? null,
    (workspaceRow.business_type_other as string | null) ?? null,
  )

  const { data: caseRow } = await supabase
    .from('cases')
    .select('id, title, customer:customers(name, primary_phone)')
    .eq('id', caseId)
    .eq('workspace_id', workspaceId)
    .single()
  if (!caseRow) throw new Error('Case not found')

  const customerArr = (Array.isArray(caseRow.customer) ? caseRow.customer : caseRow.customer ? [caseRow.customer] : []) as
    { name: string | null; primary_phone: string | null }[]
  const customer = customerArr[0] ?? null

  // Pull every call in this case, oldest first so the timeline reads like
  // the case actually happened.
  const { data: calls } = await supabase
    .from('calls')
    .select('id, started_at, summary, transcript, outcome, urgency, service_requested, system_type, service_address')
    .eq('workspace_id', workspaceId)
    .eq('case_id', caseId)
    .order('started_at', { ascending: true })

  const callRows = (calls ?? []) as {
    id: string; started_at: string; summary: string | null; transcript: unknown;
    outcome: string; urgency: string | null; service_requested: string | null;
    system_type: string | null; service_address: string | null;
  }[]
  if (callRows.length === 0) throw new Error('No calls in this case yet — nothing to summarize.')

  const callBlocks = callRows.map((c, i) => {
    const transcript = Array.isArray(c.transcript)
      ? (c.transcript as { role?: string; message?: string }[])
          .slice(0, 50)
          .map((t) => `${t.role === 'assistant' ? 'Agent' : 'Caller'}: ${t.message ?? ''}`)
          .join('\n')
      : '(no transcript)'
    return [
      `--- Call ${i + 1} of ${callRows.length} (${new Date(c.started_at).toLocaleString('en-US')}) ---`,
      `Outcome: ${c.outcome ?? 'unknown'}`,
      `Urgency: ${c.urgency ?? 'not classified'}`,
      `Service requested: ${c.service_requested ?? 'unspecified'}`,
      `System type: ${c.system_type ?? 'unspecified'}`,
      `Service address: ${c.service_address ?? 'not captured'}`,
      '',
      'Summary:',
      c.summary ?? '(no summary)',
      '',
      'Transcript:',
      transcript,
    ].join('\n')
  })

  const userPrompt = [
    `Case: ${caseRow.title ?? 'Untitled case'}`,
    `Customer: ${customer?.name ?? 'Unknown'} (${customer?.primary_phone ?? 'no phone'})`,
    `Calls in this case: ${callRows.length}`,
    '',
    ...callBlocks,
  ].join('\n')

  const response = await anthropic().messages.create({
    model: MODELS.haiku,
    max_tokens: 600,
    system: [
      { type: 'text', text: buildActionPlanSystemPrompt(trade), cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
  if (!text) throw new Error('Model returned empty action plan')

  const { error } = await supabase
    .from('cases')
    .update({ recommended_action: text })
    .eq('id', caseId)
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(`Failed to save action plan: ${error.message}`)

  revalidatePath(`/cases/${caseId}`)
  revalidatePath('/cases')
}

// -- Merge -------------------------------------------------------------------

// Loads candidate cases for the merge dialog. Wraps the data helper so the
// client modal can invoke it as a server action.
export async function loadMergeCandidates(caseId: string) {
  const { supabase, workspaceId } = await requireWorkspace()
  const { data: caseRow } = await supabase
    .from('cases')
    .select('id, customer_id')
    .eq('id', caseId)
    .eq('workspace_id', workspaceId)
    .single()
  if (!caseRow) return []
  return fetchMergeCandidates({
    workspaceId,
    customerId: caseRow.customer_id as string,
    excludeCaseId: caseId,
  })
}

// Move all calls + appointments from `fromCaseId` into `intoCaseId`, then
// delete the from-case. Both must belong to the same workspace + customer.
export async function mergeCases(formData: FormData): Promise<void> {
  const intoCaseId = formData.get('intoCaseId')
  const fromCaseId = formData.get('fromCaseId')
  if (typeof intoCaseId !== 'string' || !intoCaseId) throw new Error('intoCaseId required')
  if (typeof fromCaseId !== 'string' || !fromCaseId) throw new Error('fromCaseId required')
  if (intoCaseId === fromCaseId) throw new Error('Cannot merge a case into itself')

  const { supabase, workspaceId } = await requireWorkspace()

  const { data: both } = await supabase
    .from('cases')
    .select('id, customer_id')
    .eq('workspace_id', workspaceId)
    .in('id', [intoCaseId, fromCaseId])
  const rows = (both ?? []) as { id: string; customer_id: string }[]
  if (rows.length !== 2) throw new Error('Cases not found or not in workspace')
  if (rows[0].customer_id !== rows[1].customer_id) {
    throw new Error('Cannot merge cases for different customers')
  }

  await supabase.from('calls').update({ case_id: intoCaseId }).eq('case_id', fromCaseId).eq('workspace_id', workspaceId)
  await supabase.from('appointments').update({ case_id: intoCaseId }).eq('case_id', fromCaseId).eq('workspace_id', workspaceId)
  const { error: delErr } = await supabase.from('cases').delete().eq('id', fromCaseId).eq('workspace_id', workspaceId)
  if (delErr) throw new Error(`Merge failed deleting source case: ${delErr.message}`)
  revalidateCasePaths()
}
