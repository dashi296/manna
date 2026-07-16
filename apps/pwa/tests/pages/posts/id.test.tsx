import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { PostWithUser } from '@/entities/post'

const basePost: PostWithUser = {
  id: 'post-1',
  content: 'これは試験投稿の本文です。',
  visibility: 'public',
  created_at: '2026-05-31T10:00:00Z',
  scripture_collection: 'bofm',
  scripture_book: '1-ne',
  scripture_chapter: 3,
  scripture_verses: [7],
  user_id: 'user-1',
  users: { display_name: 'テスト太郎', avatar_url: null },
}

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: any) => ({
    ...config,
    useLoaderData: () => ({ post: basePost }),
  }),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  notFound: () => new Error('not found'),
}))

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    handler: () => vi.fn(),
    inputValidator: () => ({
      handler: () => vi.fn(),
    }),
  }),
}))

describe('PostDetailPage', () => {
  it('投稿本文を表示する', async () => {
    const mod = await import('@/pages/posts/$id')
    const PostDetailPage = (mod.Route as unknown as { component: React.ComponentType }).component
    render(<PostDetailPage />)
    expect(screen.getByText('これは試験投稿の本文です。')).toBeInTheDocument()
  })

  it('投稿者名を表示する', async () => {
    const mod = await import('@/pages/posts/$id')
    const PostDetailPage = (mod.Route as unknown as { component: React.ComponentType }).component
    render(<PostDetailPage />)
    expect(screen.getByText('テスト太郎')).toBeInTheDocument()
  })

  it('聖典参照ラベルと公式サイトへのリンクを表示する', async () => {
    const mod = await import('@/pages/posts/$id')
    const PostDetailPage = (mod.Route as unknown as { component: React.ComponentType }).component
    render(<PostDetailPage />)
    expect(screen.getByText(/第1ニーファイ書/)).toBeInTheDocument()
    expect(screen.getByText('公式サイトで読む →')).toHaveAttribute(
      'href',
      expect.stringContaining('churchofjesuschrist.org'),
    )
  })

  it('フィードへの戻るリンクを表示する', async () => {
    const mod = await import('@/pages/posts/$id')
    const PostDetailPage = (mod.Route as unknown as { component: React.ComponentType }).component
    render(<PostDetailPage />)
    expect(screen.getByText('フィード')).toBeInTheDocument()
  })
})
