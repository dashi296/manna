import { QueryClient } from '@tanstack/react-query'

// 呼び出しごとに新しく作ること。Cloudflare Workers の isolate はリクエストをまたいで
// 再利用されるため、使い回すと SSR で別ユーザーのキャッシュが混ざる。
export function createQueryClient() {
  return new QueryClient({
    // loader から SSR でプリフェッチしたときに、ハイドレート直後の再取得を避けるための既定値
    defaultOptions: { queries: { staleTime: 60 * 1000 } },
  })
}
