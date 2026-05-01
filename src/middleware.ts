import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const AUTH_PATHS = ['/login', '/signup']
const APP_PATHS = ['/dashboard', '/messages', '/workflows', '/settings']
const ONBOARDING_PREFIX = '/onboarding'
const STEP_URL = /^\/onboarding\/(\d+)$/

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — must be called before any redirect logic
  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isAuthPath = AUTH_PATHS.includes(pathname)
  const isOnboardingPath = pathname === ONBOARDING_PREFIX || pathname.startsWith(`${ONBOARDING_PREFIX}/`)
  const isAppPath = APP_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))

  // Unauthenticated: block app + onboarding, allow auth pages
  if (!user) {
    if (isAppPath || isOnboardingPath) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return supabaseResponse
  }

  // Authenticated: send them off the auth pages
  if (isAuthPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Only query onboarding state when the pathname actually cares about it.
  // Keeps the hot path short for unrelated routes (/, /api/*, /public-*).
  if (!isAppPath && !isOnboardingPath) {
    return supabaseResponse
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('onboarding_step, workspace_settings ( onboarding_completed )')
    .eq('owner_id', user.id)
    .single<{
      onboarding_step: number
      workspace_settings: { onboarding_completed: boolean } | null
    }>()

  // Defensive: if workspace lookup fails, let the page handle rendering an
  // error instead of looping the user through redirects.
  if (!workspace) return supabaseResponse

  const onboardingStep = workspace.onboarding_step
  const completed = workspace.workspace_settings?.onboarding_completed ?? false

  // Replay guard: finished users shouldn't re-enter onboarding URLs
  if (completed && isOnboardingPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Incomplete + touching app routes -> resume onboarding at current step
  if (!completed && isAppPath) {
    return NextResponse.redirect(new URL(`${ONBOARDING_PREFIX}/${onboardingStep}`, request.url))
  }

  // Bare /onboarding -> canonicalize to /onboarding/{step}
  if (!completed && pathname === ONBOARDING_PREFIX) {
    return NextResponse.redirect(new URL(`${ONBOARDING_PREFIX}/${onboardingStep}`, request.url))
  }

  // Skip-ahead guard: /onboarding/{N} where N > cursor
  if (!completed) {
    const match = pathname.match(STEP_URL)
    if (match) {
      const requested = Number(match[1])
      if (requested > onboardingStep) {
        return NextResponse.redirect(new URL(`${ONBOARDING_PREFIX}/${onboardingStep}`, request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
