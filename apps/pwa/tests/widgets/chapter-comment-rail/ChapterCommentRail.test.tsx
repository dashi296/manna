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
import { ChapterCommentRail } from '@/widgets/chapter-comment-rail'
import type { PostWithUser } from '@/entities/post'

const posts: PostWithUser[] = [
  {
    id: 'p1',
    content: 'コメ 1',
    visibility: 'public',
    created_at: '2026-07-19T00:00:00.000Z',
    scripture_collection: 'bofm',
    scripture_book: '1-ne',
    scripture_chapter: 3,
    scripture_verses: [7],
    user_id: 'u1',
    users: { display_name: '中村さん', avatar_url: null },
  },
  {
    id: 'p2',
    content: 'コメ 2',
    visibility: 'public',
    created_at: '2026-07-18T00:00:00.000Z',
    scripture_collection: 'bofm',
    scripture_book: '1-ne',
    scripture_chapter: 3,
    scripture_verses: [15],
    user_id: 'u1',
    users: { display_name: '中村さん', avatar_url: null },
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

describe('ChapterCommentRail', () => {
  it('posts が空なら null を返す', () => {
    const { container } = renderInRouter(
      <ChapterCommentRail posts={[]} selectedUserName="中村さん" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('posts を CompactPostCard として並べる', async () => {
    renderInRouter(<ChapterCommentRail posts={posts} selectedUserName="中村さん" />)
    await waitFor(() => {
      expect(screen.getByText('コメ 1')).toBeInTheDocument()
      expect(screen.getByText('コメ 2')).toBeInTheDocument()
    })
  })

  it('レール見出しに選択ユーザー名を出す', async () => {
    renderInRouter(<ChapterCommentRail posts={posts} selectedUserName="中村さん" />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /中村さんのコメント/ })).toBeInTheDocument()
    })
  })
})
