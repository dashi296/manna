import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PostCard, type PostWithUser } from '@/entities/post'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, params, children, ...props }: { to: string; params?: Record<string, string>; children: React.ReactNode; [key: string]: unknown }) => {
    const href = params ? Object.entries(params).reduce((acc, [k, v]) => acc.replace(`$${k}`, v), to) : to
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  },
}))

const basePost: PostWithUser = {
  id: 'post-1',
  content: 'これは試験投稿です。',
  visibility: 'public',
  created_at: '2026-05-31T10:00:00Z',
  scripture_collection: 'bofm',
  scripture_book: '1-ne',
  scripture_chapter: 3,
  scripture_verses: [7],
  user_id: 'user-1',
  users: { display_name: 'テスト太郎', avatar_url: null },
}

describe('PostCard', () => {
  it('投稿本文を表示する', () => {
    render(<PostCard post={basePost} />)
    expect(screen.getByText('これは試験投稿です。')).toBeInTheDocument()
  })

  it('ユーザーの表示名を表示する', () => {
    render(<PostCard post={basePost} />)
    expect(screen.getByText('テスト太郎')).toBeInTheDocument()
  })

  it('聖典参照ラベルを表示する', () => {
    render(<PostCard post={basePost} />)
    expect(screen.getByText(/第1ニーファイ書/)).toBeInTheDocument()
  })

  it('投稿日時を表示する', () => {
    render(<PostCard post={basePost} />)
    expect(screen.getByText(/2026|5月31日|5月|31/)).toBeInTheDocument()
  })

  it('display_name が null のときは「匿名ユーザー」を表示する', () => {
    const post = { ...basePost, users: { display_name: null, avatar_url: null } }
    render(<PostCard post={post} />)
    expect(screen.getByText('匿名ユーザー')).toBeInTheDocument()
  })

  it('聖典参照が null のときはバッジを表示しない', () => {
    const post = {
      ...basePost,
      scripture_collection: null,
      scripture_book: null,
      scripture_chapter: null,
      scripture_verses: null,
    }
    render(<PostCard post={post} />)
    expect(screen.queryByText(/第1ニーファイ書/)).not.toBeInTheDocument()
  })

  it('カード全体が投稿詳細ページへのリンクになっている', () => {
    render(<PostCard post={basePost} />)
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/posts/post-1')
  })

  it('聖典バッジのクリックは外側リンクへ伝播しない', () => {
    render(<PostCard post={basePost} />)
    const badge = screen.getByText(/第1ニーファイ書/).closest('span[role="link"]')!
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true })
    const stopSpy = vi.spyOn(clickEvent, 'stopPropagation')
    badge.dispatchEvent(clickEvent)
    expect(stopSpy).toHaveBeenCalled()
  })
})
