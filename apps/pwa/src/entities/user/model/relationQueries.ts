import type { QueryClient } from '@tanstack/react-query'

const PROFILE = 'profile'
const CONNECTIONS = 'connections'
const USER_POSTS = 'user-posts'
const FEED = 'feed'

export const profileKey = (userId: string) => [PROFILE, userId]
export const connectionsKey = (userId: string, tab: string) => [CONNECTIONS, userId, tab]
export const userPostsKey = (userId: string) => [USER_POSTS, userId]
export const feedKey = (tab: string) => [FEED, tab]

// フォロー/ファミリーの変更で古くなる読み取り。userId を含めないプレフィックス無効化に
// するのは、相手のプロフィールでフォローすると自分のフォロー中数も変わるため。
// 投稿一覧が入るのは、posts の RLS が 'followers'/'family' の行を関係の有無で
// 出し分けるから（フォローを外すと見えていた投稿が見えなくなる）
export function invalidateRelationQueries(queryClient: QueryClient) {
  return Promise.all(
    [PROFILE, CONNECTIONS, USER_POSTS, FEED].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    ),
  )
}

// 投稿の作成・編集・削除で古くなる一覧。tab / userId を知らなくて済むよう
// プレフィックスで落とす。フォロー関係は変わらないので profile / connections は残す
export function invalidatePostLists(queryClient: QueryClient) {
  return Promise.all(
    [USER_POSTS, FEED].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
  )
}
