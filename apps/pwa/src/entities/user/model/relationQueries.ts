import type { QueryClient } from '@tanstack/react-query'

const PROFILE = 'profile'
const CONNECTIONS = 'connections'

export const profileKey = (userId: string) => [PROFILE, userId]
export const connectionsKey = (userId: string, tab: string) => [CONNECTIONS, userId, tab]

// フォロー/ファミリーの変更で古くなる読み取り。userId を含めないプレフィックス無効化に
// するのは、相手のプロフィールでフォローすると自分のフォロー中数も変わるため。
// FollowButton / FamilyButton に渡す状態はここで落とせるクエリから取ること
// （loader や useState 由来だと、操作が確定したあとに古い値へ戻る）
export function invalidateRelationQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [PROFILE] }),
    queryClient.invalidateQueries({ queryKey: [CONNECTIONS] }),
  ])
}
