import { createFileRoute, redirect } from '@tanstack/react-router'
import { signInWithGoogle, getSession, getServerSession } from '@/shared/lib/auth'
import { LogoMark } from '@/shared/ui/LogoMark'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const session =
      typeof window === 'undefined'
        ? await getServerSession() // SSR: cookie から読み取る
        : await getSession()       // CSR: createBrowserClient から読み取る
    if (session) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 gap-10">
      {/* ロゴ + キャッチコピー */}
      <div className="text-center rise-in">
        <LogoMark className="size-16 mx-auto mb-4" />
        <p className="island-kicker mb-3">聖典学習を分かち合う</p>
        <h1
          className="display-title text-5xl font-bold mb-3"
          style={{ color: 'var(--sea-ink)' }}
        >
          Manna
        </h1>
        <p className="text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
          感動・洞察・感想をコミュニティで共有しよう
        </p>
      </div>

      {/* サインインカード */}
      <div
        className="island-shell w-full max-w-xs rounded-2xl p-6 flex flex-col gap-4 rise-in"
        style={{ animationDelay: '120ms' }}
      >
        <button
          onClick={() => signInWithGoogle()}
          className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: 'var(--surface-strong)',
            border: '1px solid var(--line)',
            color: 'var(--sea-ink)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.4 30.2 0 24 0 14.7 0 6.8 5.4 2.9 13.3l7.8 6C12.5 13.4 17.9 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.6 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.2-10.1 7.2-17z"/>
            <path fill="#FBBC05" d="M10.7 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l8.1-6z"/>
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.2-8.4 2.2-6.1 0-11.3-4-13.2-9.5l-8.1 6C6.7 42.7 14.7 48 24 48z"/>
          </svg>
          Google でサインイン
        </button>

        <p className="text-center text-[11px]" style={{ color: 'var(--sea-ink-soft)' }}>
          サインインすることで利用規約とプライバシーポリシーに同意します
        </p>
      </div>
    </div>
  )
}
