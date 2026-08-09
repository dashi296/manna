import type { QueryClient } from '@tanstack/react-query'

const PROFILE = 'profile'
const CONNECTIONS = 'connections'
const USER_POSTS = 'user-posts'
const FEED = 'feed'

export const profileKey = (userId: string) => [PROFILE, userId]
export const connectionsKey = (userId: string, tab: string) => [CONNECTIONS, userId, tab]
export const userPostsKey = (userId: string) => [USER_POSTS, userId]
export const feedKey = (tab: string) => [FEED, tab]

// 投稿一覧のプレフィックス。関係変更でも投稿の変更でも古くなるので、
// 両方の無効化がここを参照する。投稿一覧のキーを増やすときはここに足せば両方に届く
const POST_LIST_KEYS = [USER_POSTS, FEED]
const RELATION_KEYS = [PROFILE, CONNECTIONS, ...POST_LIST_KEYS]

function invalidatePrefixes(queryClient: QueryClient, keys: string[]) {
  return Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
}

// フォロー/ファミリーの変更で古くなる読み取り。userId を含めないプレフィックス無効化に
// するのは、相手のプロフィールでフォローすると自分のフォロー中数も変わるため。
// 投稿一覧が入るのは、posts の RLS が 'followers'/'family' の行を関係の有無で
// 出し分けるから（フォローを外すと見えていた投稿が見えなくなる）
export function invalidateRelationQueries(queryClient: QueryClient) {
  return invalidatePrefixes(queryClient, RELATION_KEYS)
}

// 投稿の作成・編集・削除で古くなる一覧。tab / userId を知らなくて済むよう
// プレフィックスで落とす。フォロー関係は変わらないので profile / connections は残す
export function invalidatePostLists(queryClient: QueryClient) {
  return invalidatePrefixes(queryClient, POST_LIST_KEYS)
}
