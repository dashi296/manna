import type { QueryClient } from '@tanstack/react-query'

// フォロー/ファミリーの変更で古くなる読み取りをまとめて落とす。queryKey はページ側で
// 組み立てているため、影響範囲の一覧はここが唯一。
// userId を含めないプレフィックス無効化にするのは、相手のプロフィールでフォローすると
// 自分のフォロー中数も変わるため。
// loader ベースの画面（フィード・章ページ）は遷移ごとに loader が再実行されるので対象外。
export function invalidateRelationQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['profile'] }),
    queryClient.invalidateQueries({ queryKey: ['connections'] }),
  ])
}
