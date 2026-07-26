import { createFileRoute, Link, notFound, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query'
import type { PostgrestError } from '@supabase/supabase-js'
import { FollowButton } from '@/features/follow-user'
import { EmptyState, PageHeader, TabBar, UserAvatar } from '@/shared/ui'
import { Button } from '@/shared/ui/button'
import { type CircleUserRow } from '@/entities/user'
import { resolveUserIdentity } from '@/shared/lib/constants'
import { createSupabaseServer } from '@/shared/lib/auth'
import { isValidCursor, type Cursor } from '@/shared/lib/cursor'
import { connectionsKey } from '@/shared/lib/queryKeys'

type Tab = 'followers' | 'following'
type ConnectionRowData = { user: CircleUserRow; isFollowingByMe: boolean }

const PAGE_SIZE = 20

const TAB_LABELS: Record<Tab, string> = { followers: 'フォロワー', following: 'フォロー中' }
const TABS = (Object.keys(TAB_LABELS) as Tab[]).map((id) => ({ id, label: TAB_LABELS[id] }))

// Supabase はクエリ失敗時も reject せず { data: null, error } を返すため、
// error を見ないと障害が「0件」として表示されてしまう
function unwrap<T>(res: { data: T; error: null } | { data: null; error: PostgrestError }): T {
  if (res.error) throw res.error
  return res.data
}

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

    const [followRes, { data: { user: currentUser } }] = await Promise.all([query, userPromise])

    const followRows = unwrap(followRes) as Record<string, string>[]
    const hasMore = followRows.length > PAGE_SIZE
    const page = followRows.slice(0, PAGE_SIZE)
    const otherIds = page.map((r) => r[otherIdColumn])

    if (page.length === 0) {
      // フォロー行が1件でもあれば FK により対象ユーザーは存在する。0件のときだけ、
      // 存在しないプロフィールと本当に0件とを区別する（loader が 404 にする）
      if (!cursor) {
        const owner = unwrap(
          await serverSupabase.from('users').select('id').eq('id', userId).maybeSingle(),
        )
        if (!owner) return null
      }
      return { userId, tab, currentUserId: currentUser?.id ?? null, rows: [], nextCursor: null }
    }

    const [usersRes, myFollowsRes] = await Promise.all([
      serverSupabase.from('users').select('id, display_name, avatar_url').in('id', otherIds),
      currentUser
        ? serverSupabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', currentUser.id)
            .in('following_id', otherIds)
        : null,
    ])

    const usersById = new Map(unwrap(usersRes).map((u) => [u.id, u]))
    const followingSet = new Set(
      (myFollowsRes ? unwrap(myFollowsRes) : []).map((f) => f.following_id),
    )
    const last = page[page.length - 1]

    return {
      userId,
      tab,
      currentUserId: currentUser?.id ?? null,
      rows: page.flatMap((r) => {
        const user = usersById.get(r[otherIdColumn])
        return user ? [{ user, isFollowingByMe: followingSet.has(user.id) }] : []
      }),
      nextCursor: hasMore ? { createdAt: last.created_at, otherId: last[otherIdColumn] } : null,
    }
  })

// タブごとに別のクエリになるので、切り替えても前のタブのページが混ざることはない
const connectionsQueryOptions = (userId: string, tab: Tab) =>
  infiniteQueryOptions({
    queryKey: connectionsKey(userId, tab),
    queryFn: ({ pageParam }) => fetchConnections({ data: { userId, tab, cursor: pageParam } }),
    initialPageParam: null as Cursor | null,
    getNextPageParam: (last) => last?.nextCursor ?? null,
    // 失敗したら黙って叩き直さず、「もっと見る」を押し直せる状態に戻す
    retry: false,
  })

export const Route = createFileRoute('/profile/$userId/connections')({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => ({
    tab: search.tab === 'following' ? 'following' : 'followers',
  }),
  loaderDeps: ({ search }) => ({ tab: search.tab }),
  // 1ページ目は SSR で埋めてクライアントへ引き継ぐ（ローディングのちらつきを避ける）。
  // ensureInfiniteQueryData ではなく fetchInfiniteQuery を使い staleTime を 0 にするのは、
  // 別画面でフォロー／解除してから戻ったときに古い行が出ないよう毎回取り直すため。
  // pages: 1 で追加読み込み分は捨てる（全ページ再取得は遷移のたびに N 回叩くことになる）
  loader: async ({ params, deps, context }) => {
    const options = connectionsQueryOptions(params.userId, deps.tab)
    // 「もっと見る」が飛んでいる最中に戻ってくると、fetchInfiniteQuery は進行中の Promise を
    // そのまま返す（query.js の fetchStatus !== 'idle' 分岐）。取り直しが起きないうえ、
    // 遷移がその取得の完了待ちになるため、先に打ち切る
    await context.queryClient.cancelQueries({ queryKey: options.queryKey })
    const data = await context.queryClient.fetchInfiniteQuery({
      ...options,
      staleTime: 0,
      pages: 1,
    })
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
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery(
    connectionsQueryOptions(userId, tab),
  )

  // null が入るのは対象ユーザーが存在しないときだけで、そのときは loader が 404 にしている
  const pages = (data?.pages ?? []).filter((p) => p !== null)
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
          {hasNextPage && (
            <div className="p-4 text-center">
              <Button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                variant="outline"
                size="sm"
              >
                もっと見る
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
