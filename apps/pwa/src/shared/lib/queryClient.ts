import { QueryClient } from '@tanstack/react-query'

// getRouter() から1リクエストにつき1つ作ること。モジュールスコープの単一インスタンスに
// すると、Cloudflare Workers の isolate はリクエストをまたいで再利用されるため、SSR時に
// 別ユーザーのキャッシュが混ざってしまう。ブラウザでは getRouter() がタブごとに1度しか
// 呼ばれないため、結果的にタブ内で1つのインスタンスが使い回される（望ましい挙動）。
export function createQueryClient() {
  return new QueryClient({
    // loader から SSR でプリフェッチしたときに、ハイドレート直後の再取得を避けるための既定値。
    // 現時点でその経路を通るクエリはまだ無く、唯一の useQuery は自前で staleTime を指定している。
    defaultOptions: { queries: { staleTime: 60 * 1000 } },
  })
}
