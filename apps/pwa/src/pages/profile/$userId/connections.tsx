import { createFileRoute, Link, notFound, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useInfiniteQuery } from '@tanstack/react-query'
import { FollowButton } from '@/features/follow-user'
import { EmptyState, LoadMoreButton, PageHeader, TabBar, UserAvatar } from '@/shared/ui'
import { connectionsKey, type CircleUserRow } from '@/entities/user'
import { resolveUserIdentity } from '@/shared/lib/constants'
import { createSupabaseServer } from '@/shared/lib/auth'
import { isValidCursor, takePage, withKeyset, type Cursor } from '@/shared/lib/cursor'
import { keysetInfiniteOptions, loadFirstPage } from '@/shared/lib/keysetQuery'

type Tab = 'followers' | 'following'
type ConnectionRowData = { user: CircleUserRow; isFollowingByMe: boolean }

const TAB_LABELS: Record<Tab, string> = { followers: 'フォロワー', following: 'フォロー中' }
const TABS = (Object.keys(TAB_LABELS) as Tab[]).map((id) => ({ id, label: TAB_LABELS[id] }))

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

    // フォロー行の取得結果に依存しないので、待たずに先に走らせる
    const userPromise = serverSupabase.auth.getUser()

    const query = serverSupabase
      .from('follows')
      .select(`created_at, ${otherIdColumn}`)
      .eq(ownIdColumn, userId)

    const [{ data: followData }, { data: { user: currentUser } }] = await Promise.all([
      withKeyset(query, cursor, otherIdColumn).throwOnError(),
      userPromise,
    ])

    // 同点を割るのは相手の id なので、カーソルもその列で組む
    const { rows: page, nextCursor } = takePage(
      followData as (Record<string, string> & { created_at: string })[],
      otherIdColumn,
    )
    if (page.length === 0) {
      // フォロー行が1件でもあれば FK により対象ユーザーは存在する。0件のときだけ、
      // 存在しないプロフィールと本当に0件とを区別する（loader が 404 にする）
      if (!cursor) {
        // id は主キーなので複数行にはならない（maybeSingle が複数行のとき
        // throwOnError は throw せず error を返す挙動になる）
        const { data: owner } = await serverSupabase
          .from('users')
          .select('id')
          .eq('id', userId)
          .maybeSingle()
          .throwOnError()
        if (!owner) return null
      }
      return { userId, tab, currentUserId: currentUser?.id ?? null, rows: [], nextCursor: null }
    }

    const otherIds = page.map((r) => r[otherIdColumn])

    const [{ data: users }, myFollowsRes] = await Promise.all([
      serverSupabase
        .from('users')
        .select('id, display_name, avatar_url')
        .in('id', otherIds)
        .throwOnError(),
      currentUser
        ? serverSupabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', currentUser.id)
            .in('following_id', otherIds)
            .throwOnError()
        : null,
    ])

    const usersById = new Map(users.map((u) => [u.id, u]))
    const followingSet = new Set((myFollowsRes?.data ?? []).map((f) => f.following_id))

    return {
      userId,
      tab,
      currentUserId: currentUser?.id ?? null,
      rows: page.flatMap((r) => {
        const user = usersById.get(r[otherIdColumn])
        return user ? [{ user, isFollowingByMe: followingSet.has(user.id) }] : []
      }),
      nextCursor,
    }
  })

// タブごとに別のクエリになるので、切り替えても前のタブのページが混ざることはない
const connectionsQueryOptions = (userId: string, tab: Tab) =>
  keysetInfiniteOptions(connectionsKey(userId, tab), (cursor) =>
    fetchConnections({ data: { userId, tab, cursor } }),
  )

export const Route = createFileRoute('/profile/$userId/connections')({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => ({
    tab: search.tab === 'following' ? 'following' : 'followers',
  }),
  loaderDeps: ({ search }) => ({ tab: search.tab }),
  loader: async ({ params, deps, context }) => {
    const options = connectionsQueryOptions(params.userId, deps.tab)
    const data = await loadFirstPage(context.queryClient, options)
    // 1ページ目が null なのは対象ユーザーが存在しないときだけ（server function 側の判定）
    if (!data.pages[0]) throw notFound()
  },
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
          isFollowing={row.isFollowingByMe}
        />
      )}
    </div>
  )
}

function ConnectionsPage() {
  const { userId } = Route.useParams()
  const { tab } = Route.useSearch()
  const navigate = useNavigate()
  const query = useInfiniteQuery(connectionsQueryOptions(userId, tab))

  // null が入るのは対象ユーザーが存在しないときだけで、そのときは loader が 404 にしている
  const pages = (query.data?.pages ?? []).filter((p) => p !== null)
  const allRows = pages.flatMap((p) => p.rows)
  const currentUserId = pages[0]?.currentUserId ?? null

  return (
    <div>
      <PageHeader
        title={TAB_LABELS[tab]}
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
          <LoadMoreButton query={query} />
        </div>
      )}
    </div>
  )
}
