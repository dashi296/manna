import { HeadContent, Scripts, Outlet, createRootRoute, redirect, useRouterState } from '@tanstack/react-router'
import { getSession, getServerSession } from '@/shared/lib/auth'
import { getCookieHeader } from '@/shared/lib/cookies'
import { AppSidebar } from '@/shared/ui/AppSidebar'
import { BottomNav } from '@/shared/ui/BottomNav'
import { DevTools } from '@/shared/ui/DevTools'
import { InstallPwaBanner } from '@/shared/ui/InstallPwaBanner'
import { sidebarStateFromCookieHeader, SidebarInset, SidebarProvider } from '@/shared/ui/sidebar'
import { TooltipProvider } from '@/shared/ui/tooltip'
import appCss from '@/styles.css?url'

const isDev = import.meta.env.DEV

const AUTH_REQUIRED_PREFIXES = ['/posts/new', '/profile', '/notifications']

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content' },
      { title: 'Manna' },
      { name: 'theme-color', content: '#2b7a72' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { name: 'description', content: '聖典学習の体験と感想を分かち合う' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.json' },
      { rel: 'apple-touch-icon', href: '/logo192.png' },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const needsAuth =
      location.pathname === '/' ||
      AUTH_REQUIRED_PREFIXES.some((p) => location.pathname.startsWith(p))
    if (needsAuth) {
      const session =
        typeof window === 'undefined'
          ? await getServerSession() // SSR: cookie から読み取る
          : await getSession()       // CSR: createBrowserClient から読み取る
      if (!session) throw redirect({ to: '/login' })
    }
  },
  loader: async () => ({
    sidebarDefaultOpen: sidebarStateFromCookieHeader(await getCookieHeader()),
  }),
  // defaultOpen の種にしかならないため、ナビゲーションごとの再実行は不要
  shouldReload: false,
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        {children}
        {isDev && <DevTools />}
        <Scripts />
      </body>
    </html>
  )
}

function RootLayout() {
  const { location } = useRouterState()
  const { sidebarDefaultOpen } = Route.useLoaderData()
  const isAuthPage =
    location.pathname === '/login' || location.pathname.startsWith('/auth/')

  if (isAuthPage) {
    return <Outlet />
  }

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={sidebarDefaultOpen}>
        <AppSidebar />
        <SidebarInset className="flex flex-col min-h-screen min-w-0">
          <main className="flex-1 pb-16 lg:pb-0">
            <div className="max-w-md mx-auto">
              <Outlet />
            </div>
          </main>
          <InstallPwaBanner />
          <BottomNav />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
