'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type AuthState =
  | null
  | { type: 'error'; message: string }
  | { type: 'check_email' }

export async function login(_state: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) return { type: 'error', message: error.message }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(_state: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()

  const firstName = (formData.get('first_name') as string).trim()
  const lastName = (formData.get('last_name') as string).trim()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Stored in auth.users.raw_user_meta_data — read by callback route for profile update
      data: { first_name: firstName, last_name: lastName },
    },
  })

  if (error) return { type: 'error', message: error.message }

  if (data.session && data.user) {
    // Email confirmation is disabled — session created immediately
    await supabase
      .from('profiles')
      .update({ first_name: firstName, last_name: lastName })
      .eq('id', data.user.id)

    revalidatePath('/', 'layout')
    redirect('/onboarding')
  }

  // No session — Supabase sent a confirmation email
  return { type: 'check_email' }
}
