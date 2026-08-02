import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useInfiniteQuery } from '@tanstack/react-query'
import { PostCard, POST_SELECT, type PostWithUser } from '@/entities/post'
import { EmptyState, LoadMoreButton, PageHeader, TabBar } from '@/shared/ui'
import { createSupabaseServer } from '@/shared/lib/auth'
import { isValidCursor, takePage, withKeyset, type Cursor } from '@/shared/lib/cursor'
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

    let query = serverSupabase.from('posts').select(POST_SELECT)

    if (tab === 'public') {
      query = query.eq('visibility', 'public')
    } else {
      const { data: { user } } = await serverSupabase.auth.getUser()
      if (!user) return { posts: [] as PostWithUser[], nextCursor: null }
      // ページごとに引き直す。PostgREST はサブクエリを書けないので、避けるには RPC が要る
      const { data: following } = await serverSupabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .throwOnError()
      const ids = following.map((f) => f.following_id)
      if (ids.length === 0) return { posts: [] as PostWithUser[], nextCursor: null }
      // followers/family の投稿が混じるかは RLS が決めるので、ここでは visibility を絞らない
      query = query.in('user_id', ids)
    }

    const { data } = await withKeyset(query, cursor).throwOnError()
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
