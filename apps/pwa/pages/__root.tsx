import { HeadContent, Scripts, Outlet, createRootRoute, redirect } from '@tanstack/react-router'
import { getSession, getServerSession } from '@/shared/lib/auth'
import { BottomNav } from '@/shared/ui/BottomNav'
import { DevTools } from '@/shared/ui/DevTools'
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
  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col">
      <main className="flex-1 pb-16">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
