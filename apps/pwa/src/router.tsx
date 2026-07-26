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
    defaultPreloadStaleTime: 0,
  })

  // SSR のデハイドレートと QueryClientProvider はこの中で張られるため、アプリ側では用意しない
  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
