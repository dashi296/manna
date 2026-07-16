import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { PostCard, type PostWithUser } from '@/entities/post'
import { PageHeader } from '@/shared/ui'
import { createSupabaseServer } from '@/shared/lib/auth'

const POST_SELECT = `
  id, content, visibility, created_at,
  scripture_collection, scripture_book, scripture_chapter,
  scripture_verses, user_id,
  users ( display_name, avatar_url )
`

const fetchPublicPosts = createServerFn({ method: 'GET' })
  .handler(async () => {
    const serverSupabase = await createSupabaseServer()
    const { data } = await serverSupabase
      .from('posts')
      .select(POST_SELECT)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(20)
    return (data ?? []) as PostWithUser[]
  })

const fetchFollowingPosts = createServerFn({ method: 'GET' })
  .handler(async () => {
    const serverSupabase = await createSupabaseServer()
    const { data: { user } } = await serverSupabase.auth.getUser()
    if (!user) return [] as PostWithUser[]
    const { data: following } = await serverSupabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
    const ids = following?.map((f) => f.following_id) ?? []
    if (ids.length === 0) return [] as PostWithUser[]
    const { data } = await serverSupabase
      .from('posts')
      .select(POST_SELECT)
      .in('user_id', ids)
      .order('created_at', { ascending: false })
      .limit(20)
    return (data ?? []) as PostWithUser[]
  })

type Tab = 'following' | 'public'

export const Route = createFileRoute('/')({
  loader: async () => {
    const [publicPosts, followingPosts] = await Promise.all([
      fetchPublicPosts(),
      fetchFollowingPosts(),
    ])
    return { publicPosts, followingPosts }
  },
  component: FeedPage,
})

const TABS: { id: Tab; label: string }[] = [
  { id: 'following', label: 'フォロー中' },
  { id: 'public', label: '全体' },
]

function FeedPage() {
  const { publicPosts, followingPosts } = Route.useLoaderData()
  const [tab, setTab] = useState<Tab>('following')

  const posts = tab === 'following' ? followingPosts : publicPosts

  return (
    <div>
      <PageHeader title="Manna" />
      <div className="flex border-b sticky top-0 z-10" style={{ borderColor: 'var(--line)', background: 'var(--header-bg)', backdropFilter: 'blur(8px)' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 py-3 text-sm font-medium border-b-2 transition-colors"
            style={{
              borderColor: tab === t.id ? 'var(--lagoon-deep)' : 'transparent',
              color: tab === t.id ? 'var(--lagoon-deep)' : 'var(--sea-ink-soft)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {posts.length === 0 ? (
        <div className="p-8 text-center text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
          {tab === 'following'
            ? 'フォロー中のユーザーの投稿はまだありません'
            : '投稿はまだありません'}
        </div>
      ) : (
        <div>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
