import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import { createServerFn } from '@tanstack/react-start'
import type { Database } from '@manna/database'

// ブラウザ専用関数: createBrowserClient は SSR 側で WebSocket エラーを起こすため
// ブラウザからのみ呼ばれるこれらの関数内で動的 import する
export async function signInWithGoogle() {
  const { supabase } = await import('./supabase')
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
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

function makeServerClient(cookieHeader: string, setCookie: (name: string, value: string, options?: object) => void) {
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
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => setCookie(name, value, options))
        },
      },
    },
  )
}

// createServerFn ハンドラ内で使う SSR 用 Supabase クライアントを返す
export async function createSupabaseServer() {
  const { getRequest, setCookie } = await import('@tanstack/react-start/server')
  const cookieHeader = getRequest().headers.get('cookie') ?? ''
  return makeServerClient(cookieHeader, setCookie)
}

// SSR 用: リクエストの cookie ヘッダーからセッションを読み取る
// setAll でトークンリフレッシュ時の新しい cookie をレスポンスに書き戻す
export const getServerSession = createServerFn({ method: 'GET' }).handler(async () => {
  const serverSupabase = await createSupabaseServer()
  const {
    data: { session },
  } = await serverSupabase.auth.getSession()
  return session
})

