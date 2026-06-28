import { createServerFn } from '@tanstack/react-start'
import type { Database } from '@manna/database'

export async function signInWithGoogle() {
  const { supabase } = await import('./supabase')
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/api/auth/callback`,
    },
  })
  if (error) throw error
}

export async function signOut() {
  const { supabase } = await import('./supabase')
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { supabase } = await import('./supabase')
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}

export async function createSupabaseServer() {
  const { createServerClient, parseCookieHeader } = await import('@supabase/ssr')
  const { getStartContext } = await import('@tanstack/start-storage-context')
  const cookieHeader = getStartContext()?.request?.headers.get('cookie') ?? ''
  return createServerClient<Database>(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_KEY,
    {
      cookies: {
        getAll: () =>
          parseCookieHeader(cookieHeader).map(({ name, value }) => ({
            name,
            value: value ?? '',
          })),
        setAll: () => {},
      },
    },
  )
}

export const getServerSession = createServerFn({ method: 'GET' }).handler(async () => {
  const serverSupabase = await createSupabaseServer()
  const {
    data: { session },
  } = await serverSupabase.auth.getSession()
  return session
})

export function isCodeReuseError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    msg.includes('otp_expired') ||
    msg.includes('invalid_grant') ||
    msg.includes('invalid request')
  )
}
