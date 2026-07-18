import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useEffect } from 'react'
import type { Database } from '@manna/database'
import { EmptyState, PageHeader, UserAvatar } from '@/shared/ui'
import { resolveUserIdentity, type UserSummary } from '@/shared/lib/constants'
import { formatDate } from '@/shared/lib/date'
import { createSupabaseServer } from '@/shared/lib/auth'
import { supabase } from '@/shared/lib/supabase'

type NotificationRow = {
  id: string
  type: Database['public']['Enums']['notification_type']
  read: boolean
  created_at: string
  post_id: string | null
  actor_id: string
  users: UserSummary | null
}

const LABELS: Record<NotificationRow['type'], string> = {
  liked: 'があなたの投稿にいいねしました',
  followed: 'があなたをフォローしました',
  family_requested: 'がファミリーに招待しました',
  family_accepted: 'がファミリー招待を承認しました',
}

const fetchNotifications = createServerFn({ method: 'GET' }).handler(async () => {
  const serverSupabase = await createSupabaseServer()
  const { data } = await serverSupabase
    .from('notifications')
    .select('id, type, read, created_at, post_id, actor_id, users!notifications_actor_id_fkey ( display_name, avatar_url )')
    .order('created_at', { ascending: false })
    .limit(50)
  return (data ?? []) as NotificationRow[]
})

export const Route = createFileRoute('/notifications')({
  loader: () => fetchNotifications(),
  component: NotificationsPage,
})

function NotificationsPage() {
  const notifications = Route.useLoaderData()

  useEffect(() => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length > 0) {
      void supabase.from('notifications').update({ read: true }).in('id', unreadIds).then()
    }
  }, [])

  return (
    <div>
      <PageHeader title="通知" />
      {notifications.length === 0 ? (
        <EmptyState>通知はまだありません</EmptyState>
      ) : (
        <ul>
          {notifications.map((n) => {
            const { displayName: actorName, avatarUrl } = resolveUserIdentity(n.users)
            return (
              <li
                key={n.id}
                className="flex items-start gap-3 px-4 py-3 border-b"
                style={{
                  borderColor: 'var(--line)',
                  background: n.read ? 'transparent' : 'var(--chip-bg)',
                }}
              >
                <Link to="/profile/$userId" params={{ userId: n.actor_id }}>
                  <UserAvatar name={actorName} url={avatarUrl} size="sm" />
                </Link>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: 'var(--sea-ink)' }}>
                    <Link
                      to="/profile/$userId"
                      params={{ userId: n.actor_id }}
                      className="font-semibold hover:underline"
                    >
                      {actorName}
                    </Link>
                    <span style={{ color: 'var(--sea-ink-soft)' }}>{LABELS[n.type]}</span>
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <time className="text-xs" style={{ color: 'var(--sea-ink-soft)' }}>
                      {formatDate(n.created_at)}
                    </time>
                    {n.post_id && (
                      <Link
                        to="/posts/$id"
                        params={{ id: n.post_id }}
                        className="text-xs underline"
                        style={{ color: 'var(--lagoon-deep)' }}
                      >
                        投稿を見る
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
