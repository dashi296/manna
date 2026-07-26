import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { createQueryClient } from './shared/lib/queryClient'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = createQueryClient()

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    // React Query 側にキャッシュの鮮度を任せるため、ルーターのプリロードキャッシュは無効化する
    defaultPreloadStaleTime: 0,
  })

  // ルーターと QueryClient を繋ぐ。SSR 中に解決したクエリのデハイドレート／ストリーミングと、
  // query/mutation から throw された redirect() のルーター遷移への変換を担う。
  // QueryClientProvider はこの中で張られるため、アプリ側で用意する必要はない。
  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
