import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { PostCard, POST_SELECT, type PostWithUser } from '@/entities/post'
import { FollowButton } from '@/features/follow-user'
import { FamilyButton, type FamilyStatus } from '@/features/manage-family'
import { PageHeader, UserAvatar } from '@/shared/ui'
import { createSupabaseServer } from '@/shared/lib/auth'

const fetchProfileData = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string }) => data)
  .handler(async (ctx) => {
    const { userId } = ctx.data
    const serverSupabase = await createSupabaseServer()

    const [
      { data: profile },
      {
        data: { user: currentUser },
      },
      { data: posts },
      { count: followerCount },
      { count: followingCount },
    ] = await Promise.all([
      serverSupabase.from('users').select('*').eq('id', userId).single(),
      serverSupabase.auth.getUser(),
      serverSupabase
        .from('posts')
        .select(POST_SELECT)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
      serverSupabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId),
      serverSupabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId),
    ])

    if (!profile) return null

    const isOwn = currentUser?.id === userId
    let isFollowing = false
    let familyStatus: FamilyStatus = 'none'

    if (currentUser && !isOwn) {
      const [{ data: followData }, { data: familyData }] = await Promise.all([
        serverSupabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', currentUser.id)
          .eq('following_id', userId)
          .maybeSingle(),
        serverSupabase
          .from('family_relationships')
          .select('*')
          .or(
            `and(requester_id.eq.${currentUser.id},addressee_id.eq.${userId}),` +
              `and(requester_id.eq.${userId},addressee_id.eq.${currentUser.id})`,
          )
          .maybeSingle(),
      ])
      isFollowing = !!followData
      if (familyData) {
        if (familyData.status === 'accepted') familyStatus = 'accepted'
        else if (familyData.requester_id === currentUser.id) familyStatus = 'pending_sent'
        else familyStatus = 'pending_received'
      }
    }

    return {
      profile,
      posts: (posts ?? []) as PostWithUser[],
      currentUserId: currentUser?.id ?? null,
      isOwn,
      isFollowing,
      familyStatus,
      followerCount: followerCount ?? 0,
      followingCount: followingCount ?? 0,
    }
  })

export const Route = createFileRoute('/profile/$userId')({
  loader: async ({ params }) => {
    const data = await fetchProfileData({ data: { userId: params.userId } })
    if (!data) throw notFound()
    return data
  },
  component: ProfilePage,
})

function ProfilePage() {
  const { profile, posts, currentUserId, isOwn, isFollowing, familyStatus, followerCount, followingCount } =
    Route.useLoaderData()

  const displayName = profile.display_name ?? '匿名ユーザー'
  const avatarUrl = profile.avatar_url as string | null

  return (
    <div>
      <PageHeader title={displayName} backTo="/" backLabel="フィード" />
      <div className="p-4 border-b" style={{ borderColor: 'var(--line)' }}>
        <div className="flex items-start gap-4">
          <UserAvatar name={displayName} url={avatarUrl} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate" style={{ color: 'var(--sea-ink)' }}>
              {displayName}
            </h2>
            {profile.bio && (
              <p className="text-sm mt-1" style={{ color: 'var(--sea-ink-soft)' }}>
                {profile.bio}
              </p>
            )}
            <div className="flex gap-4 mt-2 text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
              <span>
                <strong style={{ color: 'var(--sea-ink)' }}>{followerCount}</strong> フォロワー
              </span>
              <span>
                <strong style={{ color: 'var(--sea-ink)' }}>{followingCount}</strong> フォロー中
              </span>
            </div>
          </div>
        </div>
        {!isOwn && currentUserId && (
          <div className="flex gap-2 mt-3">
            <FollowButton
              targetUserId={profile.id}
              currentUserId={currentUserId}
              initialFollowing={isFollowing}
            />
            <FamilyButton
              targetUserId={profile.id}
              currentUserId={currentUserId}
              initialStatus={familyStatus}
            />
          </div>
        )}
      </div>
      <div>
        {posts.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
            投稿はまだありません
          </div>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>
    </div>
  )
}
