import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import { createServerFn } from '@tanstack/react-start'
import type { Database } from '@manna/database'
import { supabase } from './supabase'

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}

// SSR 用: リクエストの cookie ヘッダーからセッションを読み取る
export const getServerSession = createServerFn({ method: 'GET' }).handler(async () => {
  const { getRequest } = await import('@tanstack/react-start/server')
  const cookieHeader = getRequest().headers.get('cookie') ?? ''

  const serverSupabase = createServerClient<Database>(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
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

  const {
    data: { session },
  } = await serverSupabase.auth.getSession()
  return session
})
