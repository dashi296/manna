import { createFileRoute, redirect } from '@tanstack/react-router'
import { getServerSession } from '@/shared/lib/auth'

export const Route = createFileRoute('/profile/')({
  loader: async () => {
    const session = await getServerSession()
    if (!session?.user?.id) throw redirect({ to: '/login' })
    throw redirect({ to: '/profile/$userId', params: { userId: session.user.id } })
  },
  component: () => null,
})
