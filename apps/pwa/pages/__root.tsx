import { HeadContent, Scripts, Outlet, createRootRoute, redirect, useRouterState } from '@tanstack/react-router'
import { getSession, getServerSession } from '@/shared/lib/auth'
import { AppSidebar } from '@/shared/ui/AppSidebar'
import { BottomNav } from '@/shared/ui/BottomNav'
import { DevTools } from '@/shared/ui/DevTools'
import { SidebarInset, SidebarProvider } from '@/shared/ui/sidebar'
import appCss from '@/src/styles.css?url'

const isDev = import.meta.env.DEV

const AUTH_REQUIRED_PREFIXES = ['/posts/new', '/profile', '/notifications']

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Manna' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.json' },
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
  const isAuthPage =
    location.pathname === '/login' || location.pathname.startsWith('/auth/')

  if (isAuthPage) {
    return <Outlet />
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col min-h-screen min-w-0">
        <main className="flex-1 pb-16 lg:pb-0">
          <div className="max-w-md mx-auto">
            <Outlet />
          </div>
        </main>
        <BottomNav />
      </SidebarInset>
    </SidebarProvider>
  )
}
