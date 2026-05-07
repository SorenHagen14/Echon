'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type EquipmentItem = {
  id: string
  type: string
  brand?: string
  model?: string
  install_date?: string
  notes?: string
  created_at: string
}

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

// Save free-text notes on a customer record. Notes is single-field;
// the form posts the whole text, we store it verbatim.
export async function updateNotes(formData: FormData): Promise<void> {
  const customerId = formData.get('customerId')
  const notes = formData.get('notes')
  if (typeof customerId !== 'string' || !customerId) throw new Error('customerId required')
  if (typeof notes !== 'string') throw new Error('notes must be a string')

  const { supabase, workspaceId } = await requireWorkspace()
  const { error } = await supabase
    .from('customers')
    .update({ notes: notes.trim() || null })
    .eq('id', customerId)
    .eq('workspace_id', workspaceId)
  if (error) throw new Error(`Notes update failed: ${error.message}`)

  revalidatePath(`/customers/${customerId}`)
}

// Append a new equipment item to a customer's equipment array. We read,
// mutate, write — small race window but acceptable: customer records are
// rarely edited concurrently and a lost item is a 1-click re-add.
export async function addEquipment(formData: FormData): Promise<void> {
  const customerId = formData.get('customerId')
  const type = formData.get('type')
  const brand = formData.get('brand')
  const model = formData.get('model')
  const installDate = formData.get('install_date')
  const notes = formData.get('notes')

  if (typeof customerId !== 'string' || !customerId) throw new Error('customerId required')
  if (typeof type !== 'string' || !type.trim()) throw new Error('type required')

  const { supabase, workspaceId } = await requireWorkspace()
  const { data: existing, error: fetchErr } = await supabase
    .from('customers')
    .select('equipment')
    .eq('id', customerId)
    .eq('workspace_id', workspaceId)
    .single()
  if (fetchErr || !existing) throw new Error('Customer not found')

  const current = (Array.isArray(existing.equipment) ? existing.equipment : []) as EquipmentItem[]
  const next: EquipmentItem[] = [
    ...current,
    {
      id: crypto.randomUUID(),
      type: type.trim(),
      brand: typeof brand === 'string' && brand.trim() ? brand.trim() : undefined,
      model: typeof model === 'string' && model.trim() ? model.trim() : undefined,
      install_date: typeof installDate === 'string' && installDate.trim() ? installDate.trim() : undefined,
      notes: typeof notes === 'string' && notes.trim() ? notes.trim() : undefined,
      created_at: new Date().toISOString(),
    },
  ]

  const { error: updErr } = await supabase
    .from('customers')
    .update({ equipment: next })
    .eq('id', customerId)
    .eq('workspace_id', workspaceId)
  if (updErr) throw new Error(`Equipment add failed: ${updErr.message}`)

  revalidatePath(`/customers/${customerId}`)
}

export async function removeEquipment(formData: FormData): Promise<void> {
  const customerId = formData.get('customerId')
  const itemId = formData.get('itemId')
  if (typeof customerId !== 'string' || !customerId) throw new Error('customerId required')
  if (typeof itemId !== 'string' || !itemId) throw new Error('itemId required')

  const { supabase, workspaceId } = await requireWorkspace()
  const { data: existing, error: fetchErr } = await supabase
    .from('customers')
    .select('equipment')
    .eq('id', customerId)
    .eq('workspace_id', workspaceId)
    .single()
  if (fetchErr || !existing) throw new Error('Customer not found')

  const current = (Array.isArray(existing.equipment) ? existing.equipment : []) as EquipmentItem[]
  const next = current.filter((it) => it.id !== itemId)

  const { error: updErr } = await supabase
    .from('customers')
    .update({ equipment: next })
    .eq('id', customerId)
    .eq('workspace_id', workspaceId)
  if (updErr) throw new Error(`Equipment remove failed: ${updErr.message}`)

  revalidatePath(`/customers/${customerId}`)
}
