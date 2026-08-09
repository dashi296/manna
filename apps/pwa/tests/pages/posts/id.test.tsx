import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PostWithUser } from '@/entities/post'
import { routeComponent } from '../../helpers/tanstack'
import { renderWithQueryClient } from '../../helpers/query'

const basePost: PostWithUser = {
  id: 'post-1',
  content: 'これは試験投稿の本文です。',
  visibility: 'public',
  created_at: '2026-05-31T10:00:00Z',
  updated_at: '2026-05-31T10:00:00Z',
  scripture_collection: 'bofm',
  scripture_book: '1-ne',
  scripture_chapter: 3,
  scripture_verses: [7],
  user_id: 'user-1',
  users: { display_name: 'テスト太郎', avatar_url: null },
}

let loaderData: { post: PostWithUser; viewerId: string | null } = {
  post: basePost,
  viewerId: null,
}

vi.mock('@tanstack/react-router', async () =>
  (await import('../../helpers/tanstack')).routerMock(() => loaderData),
)

vi.mock('@tanstack/react-start', async () => (await import('../../helpers/tanstack')).startMock())

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: () => ({ eq: () => ({ select: async () => ({ data: [{ id: 'post-1' }], error: null }) }) }),
      delete: () => ({ eq: () => ({ select: async () => ({ data: [{ id: 'post-1' }], error: null }) }) }),
    }),
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
  },
}))

let PostDetailPage: React.ComponentType

const renderPage = () => renderWithQueryClient(() => <PostDetailPage />)

describe('PostDetailPage', () => {
  beforeEach(async () => {
    loaderData = { post: basePost, viewerId: null }
    PostDetailPage = routeComponent(await import('@/pages/posts/$id'))
  })

  it('投稿本文を表示する', () => {
    renderPage()
    expect(screen.getByText('これは試験投稿の本文です。')).toBeInTheDocument()
  })

  it('投稿者名を表示する', () => {
    renderPage()
    expect(screen.getByText('テスト太郎')).toBeInTheDocument()
  })

  it('聖典参照ラベルと公式サイトへのリンクを表示する', () => {
    renderPage()
    expect(screen.getByText(/第1ニーファイ書/)).toBeInTheDocument()
    expect(screen.getByText('公式サイトで読む →')).toHaveAttribute(
      'href',
      expect.stringContaining('churchofjesuschrist.org'),
    )
  })

  it('フィードへの戻るリンクを表示する', () => {
    renderPage()
    expect(screen.getByText('フィード')).toBeInTheDocument()
  })

  it('他人の投稿では操作メニューを出さない', () => {
    loaderData = { post: basePost, viewerId: 'someone-else' }
    renderPage()
    expect(screen.queryByRole('button', { name: '投稿の操作' })).toBeNull()
  })

  it('未ログインでは操作メニューを出さない', () => {
    loaderData = { post: basePost, viewerId: null }
    renderPage()
    expect(screen.queryByRole('button', { name: '投稿の操作' })).toBeNull()
  })

  it('自分の投稿では操作メニューを出す', () => {
    loaderData = { post: basePost, viewerId: 'user-1' }
    renderPage()
    expect(screen.getByRole('button', { name: '投稿の操作' })).toBeInTheDocument()
  })

  it('「編集」で編集シートが開き、本文が初期表示される', async () => {
    loaderData = { post: basePost, viewerId: 'user-1' }
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: '投稿の操作' }))
    await userEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: '編集' }))

    expect(screen.getByText('投稿を編集')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/感じたこと/)).toHaveValue('これは試験投稿の本文です。')
  })

  it('未編集の投稿には「編集済み」を出さない', () => {
    renderPage()
    expect(screen.queryByText('・編集済み')).toBeNull()
  })

  it('updated_at が created_at と違えば「編集済み」を出す', () => {
    loaderData = {
      post: { ...basePost, updated_at: '2026-06-01T09:00:00Z' },
      viewerId: null,
    }
    renderPage()
    expect(screen.getByText('・編集済み')).toBeInTheDocument()
  })
})
