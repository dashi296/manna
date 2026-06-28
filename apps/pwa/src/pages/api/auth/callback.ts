import { createFileRoute } from '@tanstack/react-router'
import { serializeCookieHeader } from '@supabase/ssr'
import { createSupabaseServer, isCodeReuseError } from '@/shared/lib/auth'

export const Route = createFileRoute('/api/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const code = new URL(request.url).searchParams.get('code')

        if (!code) {
          return new Response(null, { status: 302, headers: { Location: '/' } })
        }

        const setCookieStrings: string[] = []
        const extraResponseHeaders: Record<string, string> = {}

        const supabase = await createSupabaseServer({
          request,
          onSetAll: (cookies, additionalHeaders) => {
            for (const { name, value, options } of cookies) {
              setCookieStrings.push(
                serializeCookieHeader(name, value, options as Parameters<typeof serializeCookieHeader>[2]),
              )
            }
            Object.assign(extraResponseHeaders, additionalHeaders)
          },
        })

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
