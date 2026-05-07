import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Populate profile with name from user metadata.
      // Covers: email confirmation flow (first_name/last_name set at signup)
      // and Google OAuth (full_name provided by Google).
      const meta = data.user.user_metadata
      const firstName = meta.first_name ?? meta.full_name?.split(' ')[0] ?? ''
      const lastName = meta.last_name ?? meta.full_name?.split(' ').slice(1).join(' ') ?? ''

      if (firstName || lastName) {
        await supabase
          .from('profiles')
          .update({ first_name: firstName, last_name: lastName })
          .eq('id', data.user.id)
      }

      // Honor `next` for password-reset and similar flows. Restricted to
      // same-origin paths so the param can't be used to bounce users off
      // the site.
      if (next && next.startsWith('/') && !next.startsWith('//')) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      // Route to onboarding if they haven't completed it yet
      const { data: settings } = await supabase
        .from('workspace_settings')
        .select('onboarding_completed')
        .single()

      const destination = settings?.onboarding_completed ? '/dashboard' : '/onboarding'
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
