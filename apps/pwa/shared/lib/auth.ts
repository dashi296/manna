import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import { createServerFn } from '@tanstack/react-start'
import { getStartContext } from '@tanstack/start-storage-context'
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

// createServerFn ハンドラ内で使う SSR 用 Supabase クライアントを返す
// setAll は SSR では使わない（ブラウザクライアントがトークンリフレッシュを管理する）
export function createSupabaseServer() {
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

// SSR 用: リクエストの cookie ヘッダーからセッションを読み取る
// setAll でトークンリフレッシュ時の新しい cookie をレスポンスに書き戻す
export const getServerSession = createServerFn({ method: 'GET' }).handler(async () => {
  const serverSupabase = createSupabaseServer()
  const {
    data: { session },
  } = await serverSupabase.auth.getSession()
  return session
})

