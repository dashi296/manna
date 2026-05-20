import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

function isCodeReuseError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  // 認可コードは一度しか使えない。再訪・リロード時は Supabase がこれらのエラーを返す
  return msg.includes('otp_expired') || msg.includes('invalid_grant') || msg.includes('invalid request')
}

function CallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) {
      navigate({ to: '/', replace: true })
      return
    }

    import('@/shared/lib/supabase').then(async ({ supabase }) => {
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          // 通常の認証失敗は例外ではなく戻り値の error で返る
          if (!isCodeReuseError(error)) {
            navigate({ to: '/login', replace: true })
            return
          }
        }
      } catch (err) {
        // ネットワークエラーなど予期しない例外
        if (!isCodeReuseError(err)) {
          navigate({ to: '/login', replace: true })
          return
        }
      }
      navigate({ to: '/', replace: true })
    })
  }, [])

  return null
}

export const Route = createFileRoute('/auth/callback')({
  component: CallbackPage,
})
