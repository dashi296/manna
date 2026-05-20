import { createFileRoute, redirect } from '@tanstack/react-router'
import { signInWithGoogle, getSession, getServerSession } from '@/shared/lib/auth'

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
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Manna</h1>
        <p className="text-gray-500 mb-8">聖典学習を分かち合う</p>
        <button
          onClick={() => signInWithGoogle()}
          className="px-6 py-3 bg-white border border-gray-300 rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center gap-3 mx-auto"
        >
          Googleでサインイン
        </button>
      </div>
    </div>
  )
}
