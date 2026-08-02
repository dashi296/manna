import { infiniteQueryOptions, type QueryClient } from '@tanstack/react-query'
import type { Cursor } from '@/shared/lib/cursor'

// takePage が返すページの形。存在しない対象を表す null も許す（connections が使う）
type Page = { nextCursor: Cursor | null } | null

// keyset ページングの購読側。カーソルの受け渡しは cursor.ts の takePage と対で、
// ここが唯一の消費者になる
export function keysetInfiniteOptions<T extends Page>(
  queryKey: readonly unknown[],
  fetchPage: (cursor: Cursor | null) => Promise<T>,
) {
  return infiniteQueryOptions({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: null as Cursor | null,
    getNextPageParam: (last: T) => last?.nextCursor ?? null,
    // 失敗したら黙って叩き直さず、「もっと見る」を押し直せる状態に戻す
    retry: false,
  })
}

// 1ページ目を SSR で埋めてクライアントへ引き継ぐ（ローディングのちらつきを避ける）。
//
// 3つの指定はどれも落とすと静かに壊れる:
// - cancelQueries: 「もっと見る」が飛んでいる最中に戻ってくると、fetchInfiniteQuery は
//   進行中の Promise をそのまま返す（query.js の fetchStatus !== 'idle' 分岐）。
//   取り直しが起きないうえ、遷移がその取得の完了待ちになる
// - staleTime 0: 自分の操作による陳腐化は invalidateRelationQueries が拾うが、
//   他人の変更も訪問のたびに拾うためにこちらが要る
// - pages 1: 追加読み込み分は捨てる（全ページ再取得は遷移のたびに N 回叩くことになる）
export async function loadFirstPage<T extends Page>(
  queryClient: QueryClient,
  options: ReturnType<typeof keysetInfiniteOptions<T>>,
) {
  await queryClient.cancelQueries({ queryKey: options.queryKey })
  return queryClient.fetchInfiniteQuery({ ...options, staleTime: 0, pages: 1 })
}
