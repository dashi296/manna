import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@tanstack/react-router', () => ({
  // createFileRoute('/')(config) must return a callable then an object — the
  // stub `() => ({ component: undefined })` from the plan makes the outer call
  // return a plain object, which crashes when index.tsx invokes it as a function.
  createFileRoute: () => (config: any) => ({
    ...config,
    useLoaderData: () => ({ publicPosts: [], followingPosts: [] }),
  }),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  useRouterState: () => ({ location: { pathname: '/' } }),
}))

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    // getServerSession (@/shared/lib/auth, loaded transitively via @/shared/ui → AppSidebar)
    // calls .handler() directly without .inputValidator(), so both chains must be stubbed.
    handler: () => vi.fn(),
    inputValidator: () => ({
      handler: () => vi.fn(),
    }),
  }),
}))

describe('FeedPage', () => {
  it('タブ「全体」と「フォロー中」が表示される', async () => {
    const mod = await import('@/pages/index')
    expect(mod).toBeDefined()

    const FeedPage = (mod.Route as unknown as { component: React.ComponentType }).component
    render(<FeedPage />)
    expect(screen.getByText('フォロー中')).toBeInTheDocument()
    expect(screen.getByText('全体')).toBeInTheDocument()
  })
})
