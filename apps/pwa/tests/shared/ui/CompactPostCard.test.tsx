import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { CompactPostCard } from '@/shared/ui/CompactPostCard'
import type { PostWithUser } from '@/entities/post'

const post: PostWithUser = {
  id: 'post-1',
  content: '本文テキスト',
  visibility: 'public',
  created_at: '2026-07-19T00:00:00.000Z',
  scripture_collection: 'bofm',
  scripture_book: '1-ne',
  scripture_chapter: 3,
  scripture_verses: [7],
  user_id: 'u1',
  users: { display_name: '中村さん', avatar_url: null },
}

function renderInRouter(ui: React.ReactNode) {
  const root = createRootRoute({ component: () => <Outlet />, notFoundComponent: () => null })
  const index = createRoute({ getParentRoute: () => root, path: '/', component: () => <>{ui}</> })
  const postRoute = createRoute({
    getParentRoute: () => root,
    path: '/posts/$id',
    component: () => <div>post</div>,
  })
  const router = createRouter({
    routeTree: root.addChildren([index, postRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router} />)
}

describe('CompactPostCard', () => {
  it('投稿本文と投稿者名を描画する', async () => {
    renderInRouter(<CompactPostCard post={post} />)
    await waitFor(() => {
      expect(screen.getByText('本文テキスト')).toBeInTheDocument()
      expect(screen.getByText('中村さん')).toBeInTheDocument()
    })
  })

  it('scripture ラベルを描画する', async () => {
    renderInRouter(<CompactPostCard post={post} />)
    await waitFor(() => {
      expect(screen.getByText(/3:7/)).toBeInTheDocument()
    })
  })

  it('投稿ページへのリンクをアバター周辺に持つ', async () => {
    renderInRouter(<CompactPostCard post={post} />)
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /本文テキスト/ })
      expect(link).toHaveAttribute('href', '/posts/post-1')
    })
  })
})
