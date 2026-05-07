'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ResetState =
  | null
  | { type: 'error'; message: string }

const MIN_LEN = 8

export async function setNewPassword(_state: ResetState, formData: FormData): Promise<ResetState> {
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')

  if (password.length < MIN_LEN) return { type: 'error', message: `Password must be at least ${MIN_LEN} characters.` }
  if (password !== confirm) return { type: 'error', message: 'Passwords do not match.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { type: 'error', message: 'Reset link expired. Request a new one from Settings → Account.' }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { type: 'error', message: error.message }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
