import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSession, getServerSession } from '@/shared/lib/auth'

export const Route = createFileRoute('/profile/')({
  loader: async () => {
    const session =
      typeof window === 'undefined'
        ? await getServerSession() // SSR: cookie から読み取る
        : await getSession()       // CSR: createBrowserClient から読み取る
    if (!session?.user?.id) throw redirect({ to: '/login' })
    throw redirect({ to: '/profile/$userId', params: { userId: session.user.id } })
  },
  component: () => null,
})
