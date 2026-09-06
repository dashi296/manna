import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { VerseCommentSheet } from '@/widgets/verse-comment-sheet'
import type { PostWithUser } from '@/entities/post'

const posts: PostWithUser[] = [
  {
    id: 'p1',
    content: '節7 への A の投稿',
    visibility: 'public',
    created_at: '2026-07-19T00:00:00.000Z',
    updated_at: '2026-07-19T00:00:00.000Z',
    scripture_collection: 'bofm',
    scripture_book: '1-ne',
    scripture_chapter: 3,
    scripture_verses: [7],
    user_id: 'u1',
    users: { display_name: '中村さん', avatar_url: null },
  },
  {
    id: 'p2',
    content: '節5-7 への B の投稿',
    visibility: 'public',
    created_at: '2026-07-18T00:00:00.000Z',
    updated_at: '2026-07-18T00:00:00.000Z',
    scripture_collection: 'bofm',
    scripture_book: '1-ne',
    scripture_chapter: 3,
    scripture_verses: [5, 6, 7],
    user_id: 'u2',
    users: { display_name: '田中さん', avatar_url: null },
  },
]

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

describe('VerseCommentSheet', () => {
  it('open=true でヘッダーに節と件数を出す', async () => {
    renderInRouter(
      <VerseCommentSheet open={true} verse={7} posts={posts} onOpenChange={vi.fn()} />,
    )
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /7節.*2件/ })).toBeInTheDocument()
    })
  })

  it('その節に関わる投稿を投稿者を問わず並べる', async () => {
    renderInRouter(
      <VerseCommentSheet open={true} verse={7} posts={posts} onOpenChange={vi.fn()} />,
    )
    await waitFor(() => {
      expect(screen.getByText('節7 への A の投稿')).toBeInTheDocument()
      expect(screen.getByText('節5-7 への B の投稿')).toBeInTheDocument()
    })
  })

  it('複数節の投稿には範囲ラベルを出す', async () => {
    renderInRouter(
      <VerseCommentSheet open={true} verse={7} posts={posts} onOpenChange={vi.fn()} />,
    )
    await waitFor(() => {
      expect(screen.getByText(/3:5–7/)).toBeInTheDocument()
    })
  })

  it('open=false では中身を出さない', () => {
    renderInRouter(
      <VerseCommentSheet open={false} verse={7} posts={posts} onOpenChange={vi.fn()} />,
    )
    expect(screen.queryByText('節7 への A の投稿')).toBeNull()
  })

  it('内側の投稿リスト container に max-h と overflow-y-auto を持つ', async () => {
    const { container } = renderInRouter(
      <VerseCommentSheet open={true} verse={7} posts={posts} onOpenChange={vi.fn()} />,
    )
    await waitFor(() => {
      const scroller = container.ownerDocument.body.querySelector(
        '[data-slot="sheet-content"] .max-h-\\[70vh\\]',
      )
      expect(scroller).not.toBeNull()
      expect(scroller?.className).toContain('overflow-y-auto')
    })
  })
})
