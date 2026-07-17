import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { PostCard, POST_SELECT, type PostWithUser } from '@/entities/post'
import { PageHeader, TabBar } from '@/shared/ui'
import { createSupabaseServer } from '@/shared/lib/auth'

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
      <TabBar
        tabs={TABS}
        active={tab}
        onChange={setTab}
        className="sticky top-0 z-10"
        style={{ background: 'var(--header-bg)', backdropFilter: 'blur(8px)' }}
      />
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
