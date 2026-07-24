import { QueryClient } from '@tanstack/react-query'

// リクエストごと（SSR）／マウントごと（ブラウザ）に呼び出し側で `useState(createQueryClient)`
// のように使うこと。モジュールスコープの単一インスタンスにすると、Cloudflare Workers の
// isolate はリクエストをまたいで再利用されるため、SSR時に別ユーザーのキャッシュが
// 混ざってしまう。ブラウザでは RootLayout が1度しかマウントされないため、結果的に
// タブ内で1つのインスタンスが使い回される（望ましい挙動）。
export function createQueryClient() {
  return new QueryClient()
}
