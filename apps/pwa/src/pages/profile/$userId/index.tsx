import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { infiniteQueryOptions, queryOptions, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { PostCard, POST_SELECT, type PostWithUser } from '@/entities/post'
import { filterFamilyPair, resolveFamilyStatus } from '@/entities/family'
import { FollowButton } from '@/features/follow-user'
import { FamilyButton } from '@/features/manage-family'
import { SignOutButton } from '@/features/sign-out'
import { EmptyState, LoadMoreButton, PageHeader, UserAvatar } from '@/shared/ui'
import { resolveUserIdentity } from '@/shared/lib/constants'
import { createSupabaseServer } from '@/shared/lib/auth'
import { isValidCursor, takePage, withKeyset, type Cursor } from '@/shared/lib/cursor'
import { profileKey, userPostsKey } from '@/entities/user'

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
      { count: followerCount },
      { count: followingCount },
      relations,
    ] = await Promise.all([
      // maybeSingle は0件を null で返すので loader が 404 にできる。single だと0件も
      // error になり、throwOnError と併せると 404 が 500 に化ける
      serverSupabase.from('users').select('*').eq('id', userId).maybeSingle().throwOnError(),
      userPromise,
      serverSupabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId)
        .throwOnError(),
      serverSupabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId)
        .throwOnError(),
      relationsPromise,
    ])

    if (!profile) return null

    return {
      profile,
      currentUserId: currentUser?.id ?? null,
      isFollowing: relations?.isFollowing ?? false,
      familyStatus: resolveFamilyStatus(relations?.familyData, currentUser?.id ?? ''),
      followerCount: followerCount ?? 0,
      followingCount: followingCount ?? 0,
    }
  })

const fetchUserPosts = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; cursor: Cursor | null }) => {
    if (data.cursor && !isValidCursor(data.cursor)) throw new Error('invalid cursor')
    return data
  })
  .handler(async (ctx) => {
    const { userId, cursor } = ctx.data
    const serverSupabase = await createSupabaseServer()

    const query = serverSupabase.from('posts').select(POST_SELECT).eq('user_id', userId)
    const { data } = await withKeyset(query, cursor).throwOnError()
    const { rows: posts, nextCursor } = takePage(data as PostWithUser[], (p) => p.id)
    return { posts, nextCursor }
  })

// フォロー/ファミリー操作から invalidateQueries で落とせるよう、loader ではなく
// クエリに載せる（同じ画面のフォロワー数がその場で更新される）
const profileQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: profileKey(userId),
    queryFn: () => fetchProfileData({ data: { userId } }),
  })

// ページングのためにプロフィール本体とはキーを分ける。関係の変更では両方が古くなる
// （posts の RLS が followers/family の行を関係で出し分けるため）ので、どちらも
// invalidateRelationQueries の対象に入っている
const userPostsQueryOptions = (userId: string) =>
  infiniteQueryOptions({
    queryKey: userPostsKey(userId),
    queryFn: ({ pageParam }) => fetchUserPosts({ data: { userId, cursor: pageParam } }),
    initialPageParam: null as Cursor | null,
    getNextPageParam: (last) => last.nextCursor,
    // 失敗したら黙って叩き直さず、「もっと見る」を押し直せる状態に戻す
    retry: false,
  })

export const Route = createFileRoute('/profile/$userId/')({
  // SSR で埋めてクライアントへ引き継ぐ（ローディングのちらつきを避ける）。staleTime を 0 に
  // するのは、loader だった頃と同じく他人の変更も訪問のたびに拾うため
  loader: async ({ params, context }) => {
    const postsOptions = userPostsQueryOptions(params.userId)
    await context.queryClient.cancelQueries({ queryKey: postsOptions.queryKey })
    const [data] = await Promise.all([
      context.queryClient.fetchQuery({
        ...profileQueryOptions(params.userId),
        staleTime: 0,
      }),
      context.queryClient.fetchInfiniteQuery({ ...postsOptions, staleTime: 0, pages: 1 }),
    ])
    if (!data) throw notFound()
  },
  component: ProfilePage,
})

function ProfilePage() {
  const { userId } = Route.useParams()
  const { data } = useQuery(profileQueryOptions(userId))
  const {
    data: postPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(userPostsQueryOptions(userId))

  const posts = (postPages?.pages ?? []).flatMap((p) => p.posts)

  // null になるのは対象ユーザーが存在しないときだけで、loader が 404 にしている
  if (!data) return null

  const { profile, currentUserId, isFollowing, familyStatus, followerCount, followingCount } = data

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
          <>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            {hasNextPage && (
              <LoadMoreButton onClick={() => fetchNextPage()} disabled={isFetchingNextPage} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
