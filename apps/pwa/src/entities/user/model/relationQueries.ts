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
//
// 投稿一覧も対象に入る。posts の RLS は visibility が 'followers'/'family' の行を
// 関係の有無で出し分けるため、フォローを外すと見えていた投稿が見えなくなる。
// フィードの「フォロー中」タブに至っては、対象がフォロー先そのもの。
//
// 既定の refetchType は 'active' なので、実際に再取得されるのは今マウントされている
// クエリだけ。残りは stale 印が付くだけで、次の訪問時に loader が取り直す
export function invalidateRelationQueries(queryClient: QueryClient) {
  return Promise.all(
    [PROFILE, CONNECTIONS, USER_POSTS, FEED].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    ),
  )
}
