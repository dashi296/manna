import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { createSupabaseServer } from '@/shared/lib/auth'

const getCurrentUserId = createServerFn({ method: 'GET' }).handler(async () => {
  const serverSupabase = await createSupabaseServer()
  const {
    data: { user },
  } = await serverSupabase.auth.getUser()
  return user?.id ?? null
})

export const Route = createFileRoute('/profile/')({
  loader: async () => {
    const userId = await getCurrentUserId()
    if (!userId) throw redirect({ to: '/login' })
    throw redirect({ to: '/profile/$userId', params: { userId } })
  },
  component: () => null,
})
