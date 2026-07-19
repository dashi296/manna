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
import { CommenterBubble } from '@/entities/post'
import type { PostWithUser } from '@/entities/post'

const post: PostWithUser = {
  id: 'post-1',
  content: '節の吹き出しテスト',
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

describe('CommenterBubble', () => {
  it('CompactPostCard の本文を描画する', async () => {
    renderInRouter(<CommenterBubble post={post} />)
    await waitFor(() => {
      expect(screen.getByText('節の吹き出しテスト')).toBeInTheDocument()
    })
  })

  it('吹き出しラッパー div に role="group" + aria-label が付く', async () => {
    renderInRouter(<CommenterBubble post={post} />)
    await waitFor(() => {
      expect(
        screen.getByRole('group', { name: /中村さんの吹き出し/ }),
      ).toBeInTheDocument()
    })
  })
})
