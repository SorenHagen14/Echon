'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BUSINESS_TYPE_OPTIONS, type BusinessType } from '@/app/onboarding/_constants'
import { ECHON_ADMIN_EMAIL } from './_constants'

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

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

function normalizeColor(input: unknown): string {
  if (typeof input === 'string' && HEX_COLOR.test(input.trim())) {
    return input.trim().toLowerCase()
  }
  return '#64748b'
}

function nullableString(input: FormDataEntryValue | null): string | null {
  if (typeof input !== 'string') return null
  const v = input.trim()
  return v ? v : null
}

// `<input type="checkbox" value="true">` posts "true" only when checked. We
// also include a hidden `value="false"` partner in the form so an unchecked
// box still posts something — `getAll` returns ["false"] when unchecked and
// ["false", "true"] when checked.
function checkboxBool(formData: FormData, name: string): boolean {
  const all = formData.getAll(name)
  return all.some((v) => v === 'true' || v === 'on')
}

function priorityValue(input: FormDataEntryValue | null): number {
  const n = typeof input === 'string' ? Number.parseInt(input, 10) : NaN
  if (!Number.isFinite(n)) return 5
  if (n < 1) return 1
  if (n > 10) return 10
  return n
}

function operatorPayloadFromForm(formData: FormData) {
  const name = formData.get('name')
  if (typeof name !== 'string' || !name.trim()) throw new Error('Name required')
  return {
    name: name.trim(),
    email: nullableString(formData.get('email')),
    phone: nullableString(formData.get('phone')),
    color: normalizeColor(formData.get('color')),
    is_cs_rep: checkboxBool(formData, 'is_cs_rep'),
    is_technician: checkboxBool(formData, 'is_technician'),
    is_manager: checkboxBool(formData, 'is_manager'),
    priority_cs: priorityValue(formData.get('priority_cs')),
    priority_tech: priorityValue(formData.get('priority_tech')),
    priority_manager: priorityValue(formData.get('priority_manager')),
  }
}

export async function createOperator(formData: FormData): Promise<void> {
  const { supabase, workspaceId } = await requireWorkspace()
  const payload = operatorPayloadFromForm(formData)
  const { error } = await supabase.from('operators').insert({ workspace_id: workspaceId, ...payload })
  if (error) throw new Error(`Operator create failed: ${error.message}`)
  revalidatePath('/settings/team')
}

export async function updateOperator(formData: FormData): Promise<void> {
  const id = formData.get('id')
  if (typeof id !== 'string' || !id) throw new Error('id required')
  const { supabase, workspaceId } = await requireWorkspace()
  const payload = operatorPayloadFromForm(formData)
  const { error } = await supabase
    .from('operators')
    .update(payload)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(`Operator update failed: ${error.message}`)
  revalidatePath('/settings/team')
  revalidatePath('/calls')
  revalidatePath('/dashboard')
}

export async function deleteOperator(formData: FormData): Promise<void> {
  const id = formData.get('id')
  if (typeof id !== 'string' || !id) throw new Error('id required')

  const { supabase, workspaceId } = await requireWorkspace()
  const { error } = await supabase
    .from('operators')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(`Operator delete failed: ${error.message}`)
  revalidatePath('/settings/team')
  revalidatePath('/calls')
  revalidatePath('/dashboard')
}

export async function devSetTrade(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ECHON_ADMIN_EMAIL) throw new Error('Unauthorized')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) throw new Error('Workspace not found')

  const raw = formData.get('business_type')
  const valid = BUSINESS_TYPE_OPTIONS.map((o) => o.value) as BusinessType[]
  const businessType = typeof raw === 'string' && valid.includes(raw as BusinessType)
    ? (raw as BusinessType)
    : null

  await supabase
    .from('workspaces')
    .update({ business_type: businessType, business_type_other: null })
    .eq('id', workspace.id)

  revalidatePath('/settings', 'layout')
}
