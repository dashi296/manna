import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { queryOptions, useInfiniteQuery, useQuery, type QueryClient } from '@tanstack/react-query'
import { PostCard, POST_SELECT, type PostWithUser } from '@/entities/post'
import { filterFamilyPair, resolveFamilyStatus } from '@/entities/family'
import { FollowButton } from '@/features/follow-user'
import { FamilyButton } from '@/features/manage-family'
import { SignOutButton } from '@/features/sign-out'
import { EmptyState, LoadMoreButton, PageHeader, UserAvatar } from '@/shared/ui'
import { resolveUserIdentity } from '@/shared/lib/constants'
import { createSupabaseServer } from '@/shared/lib/auth'
import { isValidCursor, takePage, PAGE_SIZE, type Cursor } from '@/shared/lib/cursor'
import { keysetInfiniteOptions } from '@/shared/lib/keysetQuery'
import { profileKey, userPostsKey } from '@/entities/user'

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServer>>

// fetchProfileData（プロフィール単体、invalidateRelationQueries での再取得に使う）と
// fetchProfileInitial（#93: 初回ナビゲーション専用、投稿1ページ目込み）の両方から呼ぶ
async function queryProfileData(serverSupabase: SupabaseServer, userId: string) {
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
}

// fetchUserPosts（2ページ目以降）と fetchProfileInitial（1ページ目）の両方から呼ぶ。
// #92: user_id 単一の (created_at, id) 行比較ページングを RPC に寄せている
async function queryUserPostsPage(
  serverSupabase: SupabaseServer,
  userId: string,
  cursor: Cursor | null,
) {
  const { data } = await serverSupabase
    .rpc('posts_by_user', {
      target_user_id: userId,
      page_size: PAGE_SIZE + 1,
      ...(cursor && { cursor_created_at: cursor.createdAt, cursor_id: cursor.id }),
    })
    .select(POST_SELECT)
    .throwOnError()
  const { rows: posts, nextCursor } = takePage(data as PostWithUser[])
  return { posts, nextCursor }
}

const fetchProfileData = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string }) => data)
  .handler(async (ctx) => {
    const serverSupabase = await createSupabaseServer()
    return queryProfileData(serverSupabase, ctx.data.userId)
  })

const fetchUserPosts = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; cursor: Cursor | null }) => {
    if (data.cursor && !isValidCursor(data.cursor)) throw new Error('invalid cursor')
    return data
  })
  .handler(async (ctx) => {
    const serverSupabase = await createSupabaseServer()
    return queryUserPostsPage(serverSupabase, ctx.data.userId, ctx.data.cursor)
  })

// #93: 初回ナビゲーション専用。プロフィールと投稿1ページ目を1回の server function
// 往復にまとめる（loader だけが呼ぶ。fetchProfileData / fetchUserPosts は
// invalidateRelationQueries / 「もっと見る」から個別に叩かれるので、あえて分けたまま
// にしている — こちらに寄せると、関係の変更のたびに使われない投稿20件を無駄に
// 運ぶことになる）
const fetchProfileInitial = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string }) => data)
  .handler(async (ctx) => {
    const { userId } = ctx.data
    const serverSupabase = await createSupabaseServer()
    const [profile, postsPage] = await Promise.all([
      queryProfileData(serverSupabase, userId),
      queryUserPostsPage(serverSupabase, userId, null),
    ])
    if (!profile) return null
    return { profile, postsPage }
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
  keysetInfiniteOptions(userPostsKey(userId), (cursor) =>
    fetchUserPosts({ data: { userId, cursor } }),
  )

// hover の先読みとクリックの間隔を覆う長さ。keysetQuery の FIRST_PAGE_REUSE_MS と揃える（#86）
const PROFILE_REUSE_MS = 10 * 1000

// loadProfile が始めた取得。先読みの取得中にクリックされたら、二重に投げず相乗りする
const profileLoads = new WeakMap<QueryClient, Map<string, Promise<void>>>()

// 取り直さずに済むのは、両クエリが揃って新しく、無効化されておらず、何も取得していないときだけ。
// 取得中なら「もっと見る」か無効化後の再取得なので、下の打ち切りへ回す（#83）
function isReusable(queryClient: QueryClient, queryKey: readonly unknown[]) {
  const state = queryClient.getQueryState(queryKey)
  return (
    state?.data !== undefined &&
    !state.isInvalidated &&
    state.fetchStatus === 'idle' &&
    Date.now() - state.dataUpdatedAt < PROFILE_REUSE_MS
  )
}

// 取得中に無効化（フォロー操作など）が入ったら、この取得の結果は古いかもしれない。
// setQueryData は isInvalidated を下ろすので、見落とすと古い値が新しい扱いになる。
// キャッシュのイベントは通知が次のタスクに回されるので、開始時と播種直前の状態を比べる
function invalidationOf(queryClient: QueryClient, userId: string) {
  return [profileKey(userId), userPostsKey(userId)].map(
    (queryKey) => !!queryClient.getQueryState(queryKey)?.isInvalidated,
  )
}

// #93: 以前は fetchProfileData と fetchUserPosts の1ページ目取得が別々の
// server function 往復になっていた（cookie パース・セッション解決が2回）。
// fetchProfileInitial 1回にまとめ、両方のクエリキーへ setQueryData で種を
// 入れる。invalidateRelationQueries 経由の背後再取得は fetchProfileData /
// fetchUserPosts のまま個別に軽く保つ
async function fetchAndSeed(queryClient: QueryClient, userId: string): Promise<void> {
  // 両クエリの打ち切りは待たずに先に投げる（プロフィール取得を待たせないため）。
  // フォロー操作や invalidateRelationQueries 由来の再取得が飛んでいる最中の
  // 再訪でも、後から解決したそちらが下の setQueryData を上書きしないよう、
  // 播種の直前で待ち合わせる
  const cancelled = Promise.all([
    queryClient.cancelQueries({ queryKey: profileKey(userId) }),
    queryClient.cancelQueries({ queryKey: userPostsKey(userId) }),
  ])
  const before = invalidationOf(queryClient, userId)
  const data = await fetchProfileInitial({ data: { userId } })
  if (!data) throw notFound()
  await cancelled
  if (invalidationOf(queryClient, userId).some((now, i) => now && !before[i])) {
    return fetchAndSeed(queryClient, userId)
  }
  queryClient.setQueryData(profileQueryOptions(userId).queryKey, data.profile)
  queryClient.setQueryData(userPostsQueryOptions(userId).queryKey, {
    pages: [data.postsPage],
    pageParams: [null],
  })
}

function loadProfile(queryClient: QueryClient, userId: string) {
  if (
    isReusable(queryClient, profileKey(userId)) &&
    isReusable(queryClient, userPostsKey(userId))
  ) {
    return Promise.resolve()
  }
  let loads = profileLoads.get(queryClient)
  if (!loads) {
    loads = new Map()
    profileLoads.set(queryClient, loads)
  }
  const inFlight = loads.get(userId)
  if (inFlight) return inFlight
  const load = fetchAndSeed(queryClient, userId).finally(() => loads.delete(userId))
  loads.set(userId, load)
  return load
}

export const Route = createFileRoute('/profile/$userId/')({
  loader: ({ params, context }) => loadProfile(context.queryClient, params.userId),
  component: ProfilePage,
})

function ProfilePage() {
  const { userId } = Route.useParams()
  const { data } = useQuery(profileQueryOptions(userId))
  const postsQuery = useInfiniteQuery(userPostsQueryOptions(userId))

  const posts = (postsQuery.data?.pages ?? []).flatMap((p) => p.posts)

  // null になるのは対象ユーザーが存在しないときだけで、loader が 404 にしている
  if (!data) return null

  const { profile, currentUserId, isFollowing, familyStatus, followerCount, followingCount } = data

  const { displayName, avatarUrl } = resolveUserIdentity(profile)

  return (
    <div>
      <PageHeader title={displayName} backTo="/" backLabel="フィード" />
      <div className="p-4 border-b border-border">
        <div className="flex items-start gap-4">
          <UserAvatar name={displayName} url={avatarUrl} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate text-foreground">{displayName}</h2>
            {profile.bio && <p className="text-sm mt-1 text-muted-foreground">{profile.bio}</p>}
            <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
              <Link
                to="/profile/$userId/connections"
                params={{ userId: profile.id }}
                search={{ tab: 'followers' }}
              >
                <strong className="text-foreground">{followerCount}</strong> フォロワー
              </Link>
              <Link
                to="/profile/$userId/connections"
                params={{ userId: profile.id }}
                search={{ tab: 'following' }}
              >
                <strong className="text-foreground">{followingCount}</strong> フォロー中
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
            <LoadMoreButton query={postsQuery} />
          </>
        )}
      </div>
    </div>
  )
}
