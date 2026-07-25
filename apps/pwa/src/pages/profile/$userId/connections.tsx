import { useRef, useState } from 'react'
import { createFileRoute, Link, notFound, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import type { PostgrestError } from '@supabase/supabase-js'
import { FollowButton } from '@/features/follow-user'
import { EmptyState, PageHeader, TabBar, UserAvatar } from '@/shared/ui'
import { Button } from '@/shared/ui/button'
import { type CircleUserRow } from '@/entities/user'
import { resolveUserIdentity } from '@/shared/lib/constants'
import { createSupabaseServer } from '@/shared/lib/auth'
import { isValidCursor, type Cursor } from './-cursor'

type Tab = 'followers' | 'following'
type ConnectionRowData = { user: CircleUserRow; isFollowingByMe: boolean }
type Paged = { rows: ConnectionRowData[]; cursor: Cursor | null }

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

export const Route = createFileRoute('/profile/$userId/connections')({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => ({
    tab: search.tab === 'following' ? 'following' : 'followers',
  }),
  loaderDeps: ({ search }) => ({ tab: search.tab }),
  loader: async ({ params, deps }) => {
    const data = await fetchConnections({
      data: { userId: params.userId, tab: deps.tab, cursor: null },
    })
    if (!data) throw notFound()
    return data
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
          initialFollowing={row.isFollowingByMe}
        />
      )}
    </div>
  )
}

function ConnectionsPage() {
  const loaderData = Route.useLoaderData()
  const { userId, tab, rows, currentUserId, nextCursor } = loaderData
  const navigate = useNavigate()
  // 追加読み込み分は行とカーソルが常に一緒に動くので、1つの state にまとめる
  const [paged, setPaged] = useState<Paged>({ rows: [], cursor: nextCursor })
  const [loadingMore, setLoadingMore] = useState(false)
  const [pagedFrom, setPagedFrom] = useState(loaderData)
  const loaderDataRef = useRef(loaderData)
  loaderDataRef.current = loaderData

  // loader が新しいデータを返したら追加読み込み分を捨てる。タブ切り替えだけでなく
  // 同じタブの再読込も対象で、そうしないと新しい1ページ目に古い後続ページが繋がり
  // 行が重複・欠落する。レンダー中に調整するのは、混ざった状態で一度でも描画されると
  // key が重複するため（useEffect ではコミット後まで反映が遅れる）。
  if (pagedFrom !== loaderData) {
    setPagedFrom(loaderData)
    setPaged({ rows: [], cursor: nextCursor })
    // 進行中の取得は新しい一覧には関係ないので、待たずに次のページを引けるようにする
    setLoadingMore(false)
  }

  const loadMore = async () => {
    const cursor = paged.cursor
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    const requestedFrom = loaderData
    try {
      // カーソル付きの取得では null は返らない（null は1ページ目で対象ユーザーが
      // 存在しなかった場合だけ）が、型の上では起こりうるので弾く
      const next = await fetchConnections({ data: { userId, tab, cursor } })
      if (!next) return
      // 取得中に loader データが入れ替わっていたら、古い結果は新しい一覧に混ぜない
      if (requestedFrom !== loaderDataRef.current) return
      setPaged((prev) => ({ rows: [...prev.rows, ...next.rows], cursor: next.nextCursor }))
    } catch {
      // 失敗時は追記せず、ボタンを押せる状態に戻すだけにする
    } finally {
      // 世代が変わっていれば、この取得はもう現在の一覧のものではない。
      // ここで解除すると、新しい一覧で進行中の取得の状態を奪ってしまう
      if (requestedFrom === loaderDataRef.current) setLoadingMore(false)
    }
  }

  const allRows = [...rows, ...paged.rows]

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
          {paged.cursor && (
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
