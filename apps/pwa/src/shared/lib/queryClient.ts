import { QueryClient } from '@tanstack/react-query'

// getRouter() から1リクエストにつき1つ作ること。モジュールスコープの単一インスタンスに
// すると、Cloudflare Workers の isolate はリクエストをまたいで再利用されるため、SSR時に
// 別ユーザーのキャッシュが混ざってしまう。ブラウザでは getRouter() がタブごとに1度しか
// 呼ばれないため、結果的にタブ内で1つのインスタンスが使い回される（望ましい挙動）。
export function createQueryClient() {
  return new QueryClient({
    // SSR でサーバー取得済みのクエリが、ハイドレート直後にクライアントで即再取得
    // されるのを防ぐ（既定の 0 のままだとマウント時に必ず stale 扱いになる）。
    defaultOptions: { queries: { staleTime: 60 * 1000 } },
  })
}
