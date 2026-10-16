import {
  hashKey,
  infiniteQueryOptions,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
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

// hover の先読みとクリックの間隔を覆う長さ。router は defaultPreloadStaleTime: 0 で
// 毎回 loader を呼ぶので、取り直すかどうかはここで決める（#86）
const FIRST_PAGE_REUSE_MS = 10 * 1000

// loadFirstPage が始めた1ページ目の取得。飛んでいる取得の種類は QueryState から
// 判別できない（キャッシュのページ数は取得中の範囲を表さない）ので自分で覚える
const firstPageLoads = new WeakMap<QueryClient, Map<string, Promise<unknown>>>()

// 1ページ目を SSR で埋めてクライアントへ引き継ぐ（ローディングのちらつきを避ける）。
//
// 3つの指定はどれも落とすと静かに壊れる:
// - 相乗りと打ち切り: 飛んでいる取得があると fetchInfiniteQuery はその Promise を
//   そのまま返す（query.js の fetchStatus !== 'idle' 分岐）ので pages 1 が効かない。
//   自分が始めた1ページ目の取得（先読み）なら相乗りし、それ以外（「もっと見る」や
//   複数ページの取り直し）なら遷移がその完了待ちになるので打ち切る
// - staleTime: 先読み直後のクリックでは取り直さず、時間が経った訪問では他人の変更を拾う。
//   自分の操作による陳腐化は invalidateRelationQueries が isInvalidated で拾う
// - pages 1: 追加読み込み分は捨てる（全ページ再取得は遷移のたびに N 回叩くことになる）
export function loadFirstPage<T extends Page>(
  queryClient: QueryClient,
  options: ReturnType<typeof keysetInfiniteOptions<T>>,
): Promise<InfiniteData<T, Cursor | null>> {
  let loads = firstPageLoads.get(queryClient)
  if (!loads) {
    loads = new Map()
    firstPageLoads.set(queryClient, loads)
  }
  const key = hashKey(options.queryKey)
  const inFlight = loads.get(key)
  if (inFlight) return inFlight as Promise<InfiniteData<T, Cursor | null>>

  const load = (async () => {
    if ((queryClient.getQueryState(options.queryKey)?.fetchStatus ?? 'idle') !== 'idle') {
      await queryClient.cancelQueries({ queryKey: options.queryKey })
    }
    return queryClient.fetchInfiniteQuery({ ...options, staleTime: FIRST_PAGE_REUSE_MS, pages: 1 })
  })().finally(() => loads.delete(key))
  loads.set(key, load)
  return load
}
