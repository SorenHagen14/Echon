'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const MAX_NAME_LEN = 80
const MAX_AVATAR_BYTES = 2 * 1024 * 1024 // 2 MB
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function trimToNull(input: FormDataEntryValue | null, max = MAX_NAME_LEN): string | null {
  if (typeof input !== 'string') return null
  const v = input.trim().slice(0, max)
  return v ? v : null
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

export type AccountActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string }

export async function updateProfile(formData: FormData): Promise<AccountActionResult> {
  const { supabase, user } = await requireUser()

  const firstName = trimToNull(formData.get('first_name')) ?? ''
  const lastName = trimToNull(formData.get('last_name')) ?? ''
  const displayName = trimToNull(formData.get('display_name'))

  const { error } = await supabase
    .from('profiles')
    .update({ first_name: firstName, last_name: lastName, display_name: displayName })
    .eq('id', user.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/settings/account')
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Profile saved.' }
}

export async function uploadAvatar(formData: FormData): Promise<AccountActionResult> {
  const { supabase, user } = await requireUser()

  const file = formData.get('avatar')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose an image to upload.' }
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, error: 'Image too large (max 2 MB).' }
  }
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    return { ok: false, error: 'Use JPEG, PNG, WebP, or GIF.' }
  }

  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'png'
  const path = `${user.id}/avatar-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) return { ok: false, error: uploadError.message }

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)

  // Best-effort cleanup of the previous avatar so the bucket doesn't grow forever.
  const { data: prior } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).single()
  if (prior?.avatar_url) {
    const priorPath = extractStoragePath(prior.avatar_url)
    if (priorPath) await supabase.storage.from('avatars').remove([priorPath])
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: urlData.publicUrl })
    .eq('id', user.id)
  if (updateError) return { ok: false, error: updateError.message }

  revalidatePath('/settings/account')
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Avatar updated.' }
}

export async function removeAvatar(): Promise<AccountActionResult> {
  const { supabase, user } = await requireUser()

  const { data: prior } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).single()
  if (prior?.avatar_url) {
    const priorPath = extractStoragePath(prior.avatar_url)
    if (priorPath) await supabase.storage.from('avatars').remove([priorPath])
  }

  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/settings/account')
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Avatar removed.' }
}

export async function requestPasswordReset(): Promise<AccountActionResult> {
  const { supabase, user } = await requireUser()
  if (!user.email) return { ok: false, error: 'No email on file.' }

  const origin = await resolveOrigin()
  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })
  if (error) return { ok: false, error: error.message }

  return { ok: true, message: `Reset link sent to ${user.email}. Click it to set a new password.` }
}

// Picks up the deployment origin from the request headers so the redirect
// URL works in dev, preview, and prod without a hardcoded base.
async function resolveOrigin(): Promise<string> {
  const { headers } = await import('next/headers')
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function requestEmailChange(formData: FormData): Promise<AccountActionResult> {
  const { supabase, user } = await requireUser()

  const newEmail = trimToNull(formData.get('email'), 254)
  if (!newEmail) return { ok: false, error: 'Email required.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return { ok: false, error: 'Invalid email.' }
  if (newEmail.toLowerCase() === user.email?.toLowerCase()) {
    return { ok: false, error: 'That is already your email.' }
  }

  // Supabase sends a confirmation link to BOTH the old and new addresses.
  // The change only takes effect after the new address confirms.
  const { error } = await supabase.auth.updateUser({ email: newEmail })
  if (error) return { ok: false, error: error.message }

  return { ok: true, message: `Confirmation link sent to ${newEmail}. Click it to finish the change.` }
}

// Public Supabase Storage URL → "{user.id}/avatar-...ext". Used to locate
// the prior object so we can delete it after a re-upload or removal.
function extractStoragePath(publicUrl: string): string | null {
  const marker = '/storage/v1/object/public/avatars/'
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return null
  return publicUrl.slice(idx + marker.length)
}
