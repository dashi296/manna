import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useInfiniteQuery } from '@tanstack/react-query'
import { PostCard, POST_SELECT, type PostWithUser } from '@/entities/post'
import { EmptyState, LoadMoreButton, PageHeader, TabBar } from '@/shared/ui'
import { createSupabaseServer } from '@/shared/lib/auth'
import { isValidCursor, takePage, PAGE_SIZE, type Cursor } from '@/shared/lib/cursor'
import { keysetInfiniteOptions, loadFirstPage } from '@/shared/lib/keysetQuery'
import { feedKey } from '@/entities/user'

type Tab = 'following' | 'public'

const DEFAULT_TAB: Tab = 'following'

const TABS: { id: Tab; label: string }[] = [
  { id: 'following', label: 'フォロー中' },
  { id: 'public', label: '全体' },
]

const EMPTY_LABELS: Record<Tab, string> = {
  following: 'フォロー中のユーザーの投稿はまだありません',
  public: '投稿はまだありません',
}

const fetchFeed = createServerFn({ method: 'POST' })
  .inputValidator((data: { tab: Tab; cursor: Cursor | null }) => {
    if (data.cursor && !isValidCursor(data.cursor)) throw new Error('invalid cursor')
    return data
  })
  .handler(async (ctx) => {
    const { tab, cursor } = ctx.data
    const serverSupabase = await createSupabaseServer()

    // #92: .or() の OR 形式カーソルは (created_at, id) の Index Cond にならず、
    // フォロー中タブは毎ページ follows を引き直して .in() の URL に載せていた
    // （フォロー数が多いと 414 になりうる）。(created_at, id) の行比較と
    // follows×posts の結合を SQL 関数に寄せ、未認証は関数内で空になる
    const rpcName = tab === 'public' ? 'posts_feed_public' : 'posts_feed_following'
    const { data } = await serverSupabase
      .rpc(rpcName, {
        page_size: PAGE_SIZE + 1,
        ...(cursor && { cursor_created_at: cursor.createdAt, cursor_id: cursor.id }),
      })
      .select(POST_SELECT)
      .throwOnError()

    const { rows: posts, nextCursor } = takePage(data as PostWithUser[])
    return { posts, nextCursor }
  })

// タブごとに別のクエリになるので、切り替えても前のタブのページが混ざることはない
const feedQueryOptions = (tab: Tab) =>
  keysetInfiniteOptions(feedKey(tab), (cursor) => fetchFeed({ data: { tab, cursor } }))

export const Route = createFileRoute('/')({
  // 既定タブでは付けない。他の画面から to: "/" で戻るときに search を書かせないため
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } =>
    search.tab === 'public' ? { tab: 'public' } : {},
  loaderDeps: ({ search }) => ({ tab: search.tab ?? DEFAULT_TAB }),
  loader: ({ deps, context }) => loadFirstPage(context.queryClient, feedQueryOptions(deps.tab)),
  component: FeedPage,
})

function FeedPage() {
  const { tab = DEFAULT_TAB } = Route.useSearch()
  const navigate = useNavigate()
  const query = useInfiniteQuery(feedQueryOptions(tab))

  const posts = (query.data?.pages ?? []).flatMap((p) => p.posts)

  return (
    <div>
      <PageHeader title="Manna" />
      <TabBar
        tabs={TABS}
        active={tab}
        onChange={(id) => navigate({ to: '/', search: id === DEFAULT_TAB ? {} : { tab: id } })}
        className="sticky top-0 z-10"
        style={{ background: 'var(--header-bg)', backdropFilter: 'blur(8px)' }}
      />
      {posts.length === 0 ? (
        <EmptyState>{EMPTY_LABELS[tab]}</EmptyState>
      ) : (
        <div>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          <LoadMoreButton query={query} />
        </div>
      )}
    </div>
  )
}
