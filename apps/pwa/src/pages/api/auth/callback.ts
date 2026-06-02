import { createFileRoute } from '@tanstack/react-router'
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import type { Database } from '@manna/database'
import { isCodeReuseError } from '@/shared/lib/auth'

export const Route = createFileRoute('/api/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const code = new URL(request.url).searchParams.get('code')

        if (!code) {
          return new Response(null, { status: 302, headers: { Location: '/' } })
        }

        // setAll 内でシリアライズ済みの文字列として収集する（型互換問題を回避）
        const setCookieStrings: string[] = []
        const extraResponseHeaders: Record<string, string> = {}

        const supabase = createServerClient<Database>(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_KEY,
          {
            cookies: {
              getAll: () =>
                parseCookieHeader(request.headers.get('cookie') ?? '').map(({ name, value }) => ({
                  name,
                  value: value ?? '',
                })),
              setAll: (cookies, additionalHeaders) => {
                for (const { name, value, options } of cookies) {
                  setCookieStrings.push(
                    serializeCookieHeader(name, value, options as Parameters<typeof serializeCookieHeader>[2]),
                  )
                }
                Object.assign(extraResponseHeaders, additionalHeaders)
              },
            },
          },
        )

        const { error } = await supabase.auth.exchangeCodeForSession(code)

        const destination = !error || isCodeReuseError(error) ? '/' : '/login'
        const headers = new Headers({ Location: destination })

        for (const cookie of setCookieStrings) {
          headers.append('Set-Cookie', cookie)
        }
        for (const [key, val] of Object.entries(extraResponseHeaders)) {
          headers.set(key, val)
        }

        return new Response(null, { status: 302, headers })
      },
    },
  },
})
