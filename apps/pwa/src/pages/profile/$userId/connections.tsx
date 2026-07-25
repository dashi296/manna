import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { FollowButton } from '@/features/follow-user'
import { EmptyState, PageHeader, TabBar, UserAvatar } from '@/shared/ui'
import { Button } from '@/shared/ui/button'
import { resolveUserIdentity } from '@/shared/lib/constants'
import { createSupabaseServer } from '@/shared/lib/auth'
import { isValidCursor, type Cursor } from './-cursor'

type Tab = 'followers' | 'following'
type ConnectionUser = { id: string; display_name: string | null; avatar_url: string | null }
export type ConnectionRowData = { user: ConnectionUser; isFollowingByMe: boolean }

const PAGE_SIZE = 20

const TABS: { id: Tab; label: string }[] = [
  { id: 'followers', label: 'フォロワー' },
  { id: 'following', label: 'フォロー中' },
]

export const fetchConnections = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; tab: Tab; cursor: Cursor | null }) => {
    if (data.cursor && !isValidCursor(data.cursor)) throw new Error('invalid cursor')
    return data
  })
  .handler(async (ctx) => {
    const { userId, tab, cursor } = ctx.data
    const serverSupabase = await createSupabaseServer()
    const otherIdColumn = tab === 'followers' ? 'follower_id' : 'following_id'
    const ownIdColumn = tab === 'followers' ? 'following_id' : 'follower_id'

    let query = serverSupabase
      .from('follows')
      .select(`created_at, ${otherIdColumn}`)
      .eq(ownIdColumn, userId)
      .order('created_at', { ascending: false })
      .order(otherIdColumn, { ascending: false })
      .limit(PAGE_SIZE + 1)

    // (created_at, otherId) < カーソル の keyset 条件。PostgREST は '.' と ',' を
    // 区切りに使うため、小数秒を含む timestamptz はダブルクォートで囲む。
    if (cursor) {
      query = query.or(
        `created_at.lt."${cursor.createdAt}",` +
          `and(created_at.eq."${cursor.createdAt}",${otherIdColumn}.lt."${cursor.otherId}")`,
      )
    }

    const { data: followRows } = await query
    const hasMore = (followRows ?? []).length > PAGE_SIZE
    const page = ((followRows ?? []) as Record<string, string>[]).slice(0, PAGE_SIZE)
    const otherIds = page.map((r) => r[otherIdColumn])

    const {
      data: { user: currentUser },
    } = await serverSupabase.auth.getUser()

    const [usersRes, myFollowsRes] = await Promise.all([
      otherIds.length
        ? serverSupabase.from('users').select('id, display_name, avatar_url').in('id', otherIds)
        : null,
      currentUser && otherIds.length
        ? serverSupabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', currentUser.id)
            .in('following_id', otherIds)
        : null,
    ])

    const usersById = new Map((usersRes?.data ?? []).map((u) => [u.id, u]))
    const followingSet = new Set((myFollowsRes?.data ?? []).map((f) => f.following_id))
    const last = page[page.length - 1]

    return {
      userId,
      tab,
      currentUserId: currentUser?.id ?? null,
      rows: page.flatMap((r) => {
        const user = usersById.get(r[otherIdColumn])
        return user ? [{ user, isFollowingByMe: followingSet.has(user.id) }] : []
      }),
      nextCursor:
        hasMore && last
          ? { createdAt: last.created_at, otherId: last[otherIdColumn] }
          : null,
    }
  })

export const Route = createFileRoute('/profile/$userId/connections')({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => ({
    tab: search.tab === 'following' ? 'following' : 'followers',
  }),
  loaderDeps: ({ search }) => ({ tab: search.tab }),
  loader: ({ params, deps }) =>
    fetchConnections({ data: { userId: params.userId, tab: deps.tab, cursor: null } }),
  component: ConnectionsPage,
})

function ConnectionRow({
  row,
  currentUserId,
}: {
  row: ConnectionRowData
  currentUserId: string | null
}) {
  const { displayName, avatarUrl } = resolveUserIdentity(row.user)
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b"
      style={{ borderColor: 'var(--line)' }}
    >
      <Link
        to="/profile/$userId"
        params={{ userId: row.user.id }}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        <UserAvatar name={displayName} url={avatarUrl} size="sm" />
        <span
          className="text-sm font-semibold truncate"
          style={{ color: 'var(--sea-ink)' }}
        >
          {displayName}
        </span>
      </Link>
      {currentUserId && currentUserId !== row.user.id && (
        <FollowButton
          targetUserId={row.user.id}
          currentUserId={currentUserId}
          initialFollowing={row.isFollowingByMe}
        />
      )}
    </div>
  )
}

function ConnectionsPage() {
  const { userId, tab, rows, currentUserId, nextCursor } = Route.useLoaderData()
  const navigate = useNavigate()
  const [extraRows, setExtraRows] = useState<ConnectionRowData[]>([])
  const [cursor, setCursor] = useState<Cursor | null>(nextCursor)
  const [loadingMore, setLoadingMore] = useState(false)
  const [prevTab, setPrevTab] = useState(tab)

  // タブ切り替えで loader が再実行されたら、前のタブの追加読み込み分を捨てる。
  // レンダー中に調整することで、新タブの rows と前タブの extraRows が混ざって
  // 一瞬 key が重複する（useEffect だとコミット後まで反映が遅れる）のを防ぐ。
  if (prevTab !== tab) {
    setPrevTab(tab)
    setExtraRows([])
    setCursor(nextCursor)
  }

  const loadMore = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const next = await fetchConnections({ data: { userId, tab, cursor } })
      setExtraRows((prev) => [...prev, ...next.rows])
      setCursor(next.nextCursor)
    } catch {
      // 失敗時は追記せず、ボタンを押せる状態に戻すだけにする
    } finally {
      setLoadingMore(false)
    }
  }

  const allRows = [...rows, ...extraRows]

  return (
    <div>
      <PageHeader
        title={tab === 'followers' ? 'フォロワー' : 'フォロー中'}
        backTo="/profile/$userId"
        backLabel="プロフィール"
      />
      <TabBar
        tabs={TABS}
        active={tab}
        onChange={(id) =>
          navigate({
            to: '/profile/$userId/connections',
            params: { userId },
            search: { tab: id },
          })
        }
      />
      {allRows.length === 0 ? (
        <EmptyState>
          {tab === 'followers' ? 'まだフォロワーがいません' : 'まだ誰もフォローしていません'}
        </EmptyState>
      ) : (
        <div>
          {allRows.map((row) => (
            <ConnectionRow key={row.user.id} row={row} currentUserId={currentUserId} />
          ))}
          {cursor && (
            <div className="p-4 text-center">
              <Button onClick={loadMore} disabled={loadingMore} variant="outline" size="sm">
                もっと見る
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
