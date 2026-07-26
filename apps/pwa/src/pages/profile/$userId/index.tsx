import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { PostCard, POST_SELECT, type PostWithUser } from '@/entities/post'
import { filterFamilyPair, resolveFamilyStatus } from '@/entities/family'
import { FollowButton } from '@/features/follow-user'
import { FamilyButton } from '@/features/manage-family'
import { SignOutButton } from '@/features/sign-out'
import { EmptyState, PageHeader, UserAvatar } from '@/shared/ui'
import { resolveUserIdentity } from '@/shared/lib/constants'
import { createSupabaseServer } from '@/shared/lib/auth'
import { profileKey } from '@/shared/lib/queryKeys'

const fetchProfileData = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string }) => data)
  .handler(async (ctx) => {
    const { userId } = ctx.data
    const serverSupabase = await createSupabaseServer()

    const userPromise = serverSupabase.auth.getUser()
    const relationsPromise = userPromise.then(async ({ data: { user } }) => {
      if (!user || user.id === userId) return null
      const [{ data: followData }, { data: familyData }] = await Promise.all([
        serverSupabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', user.id)
          .eq('following_id', userId)
          .maybeSingle(),
        filterFamilyPair(
          serverSupabase.from('family_relationships').select('*'),
          user.id,
          userId,
        ).maybeSingle(),
      ])
      return { isFollowing: !!followData, familyData }
    })

    const [
      { data: profile },
      {
        data: { user: currentUser },
      },
      { data: posts },
      { count: followerCount },
      { count: followingCount },
      relations,
    ] = await Promise.all([
      serverSupabase.from('users').select('*').eq('id', userId).single(),
      userPromise,
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
      relationsPromise,
    ])

    if (!profile) return null

    return {
      profile,
      posts: (posts ?? []) as PostWithUser[],
      currentUserId: currentUser?.id ?? null,
      isFollowing: relations?.isFollowing ?? false,
      familyStatus: resolveFamilyStatus(relations?.familyData, currentUser?.id ?? ''),
      followerCount: followerCount ?? 0,
      followingCount: followingCount ?? 0,
    }
  })

// フォロー/ファミリー操作から invalidateQueries で落とせるよう、loader ではなく
// クエリに載せる（同じ画面のフォロワー数がその場で更新される）
const profileQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: profileKey(userId),
    queryFn: () => fetchProfileData({ data: { userId } }),
  })

export const Route = createFileRoute('/profile/$userId/')({
  // SSR で埋めてクライアントへ引き継ぐ（ローディングのちらつきを避ける）。staleTime を 0 に
  // するのは、別画面でフォロー／解除してから戻ったときに古い件数が出ないよう毎回取り直すため
  loader: async ({ params, context }) => {
    const data = await context.queryClient.fetchQuery({
      ...profileQueryOptions(params.userId),
      staleTime: 0,
    })
    if (!data) throw notFound()
  },
  component: ProfilePage,
})

function ProfilePage() {
  const { userId } = Route.useParams()
  const { data } = useQuery(profileQueryOptions(userId))

  // null になるのは対象ユーザーが存在しないときだけで、loader が 404 にしている
  if (!data) return null

  const { profile, posts, currentUserId, isFollowing, familyStatus, followerCount, followingCount } =
    data

  const { displayName, avatarUrl } = resolveUserIdentity(profile)

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
              <Link
                to="/profile/$userId/connections"
                params={{ userId: profile.id }}
                search={{ tab: 'followers' }}
              >
                <strong style={{ color: 'var(--sea-ink)' }}>{followerCount}</strong> フォロワー
              </Link>
              <Link
                to="/profile/$userId/connections"
                params={{ userId: profile.id }}
                search={{ tab: 'following' }}
              >
                <strong style={{ color: 'var(--sea-ink)' }}>{followingCount}</strong> フォロー中
              </Link>
            </div>
          </div>
        </div>
        {currentUserId && (
          <div className="flex gap-2 mt-3">
            {currentUserId === profile.id ? (
              <SignOutButton />
            ) : (
              <>
                <FollowButton
                  targetUserId={profile.id}
                  currentUserId={currentUserId}
                  isFollowing={isFollowing}
                />
                <FamilyButton
                  targetUserId={profile.id}
                  currentUserId={currentUserId}
                  status={familyStatus}
                />
              </>
            )}
          </div>
        )}
      </div>
      <div>
        {posts.length === 0 ? (
          <EmptyState>投稿はまだありません</EmptyState>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>
    </div>
  )
}
