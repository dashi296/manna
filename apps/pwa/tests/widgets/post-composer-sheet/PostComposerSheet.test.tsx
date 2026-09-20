import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PostComposerSheet } from '@/widgets/post-composer-sheet'

const mockInsert = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: mockInsert,
      update: () => ({
        eq: () => ({ select: async () => ({ data: [{ id: 'p1' }], error: null }) }),
      }),
    }),
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  },
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

describe('PostComposerSheet', () => {
  beforeEach(() => {
    localStorage.clear()
    window.innerWidth = 1024
  })

  // onClosed は ref 経由で読む。呼び出し側は毎描画で callback を作り直すため、
  // 「閉じる」と「callback の差し替え」が同じコミットに入る。このとき [open] effect の
  // cleanup が ref 更新より先に走ると古い callback を呼んでしまうので、ref の更新は
  // layout effect に置いている（passive cleanup より前に走る）
  it('閉じるのと同じ描画で onClosed が差し替わっても、最新のものが呼ばれる', async () => {
    const first = vi.fn()
    const second = vi.fn()
    // ブラウザバック経由の close を再現するため、マーカーの無い履歴から始める
    window.history.replaceState(null, '')

    const { rerender } = render(<PostComposerSheet open onOpenChange={() => {}} onClosed={first} />)

    // open=false と新しい onClosed を同じ rerender で渡す。間に描画を挟まない
    window.history.replaceState(null, '')
    rerender(<PostComposerSheet open={false} onOpenChange={() => {}} onClosed={second} />)

    await waitFor(() => expect(second).toHaveBeenCalledTimes(1))
    expect(first).not.toHaveBeenCalled()
  })

  it('open=false ではシート内容が描画されない', () => {
    render(<PostComposerSheet open={false} onOpenChange={() => {}} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('open=true でシートが開き、タイトルに節ラベルが表示される', () => {
    render(
      <PostComposerSheet
        open
        onOpenChange={() => {}}
        initialScripture={{ collection: 'bofm', book: 'mosiah', chapter: 3, verses: [19] }}
      />,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/モーサヤ書 3:19/)).toBeInTheDocument()
  })

  it('lockScripture を PostEditor に伝え、聖典参照のセレクタを出さない', () => {
    render(
      <PostComposerSheet
        open
        onOpenChange={() => {}}
        initialScripture={{ collection: 'bofm', book: 'mosiah', chapter: 3 }}
        lockScripture
      />,
    )
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
  })

  it('lockScripture なしなら聖典参照のセレクタを出す', () => {
    render(
      <PostComposerSheet
        open
        onOpenChange={() => {}}
        initialScripture={{ collection: 'bofm', book: 'mosiah', chapter: 3 }}
      />,
    )
    expect(screen.getAllByRole('combobox')).toHaveLength(3)
  })

  it('initialScripture 未指定なら「新しい投稿」タイトル', () => {
    render(<PostComposerSheet open onOpenChange={() => {}} />)
    expect(screen.getByText('新しい投稿')).toBeInTheDocument()
  })

  it('デスクトップ幅では右サイドパネルとして表示する', async () => {
    window.innerWidth = 1200

    render(<PostComposerSheet open onOpenChange={() => {}} />)

    await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('data-side', 'right'))
    expect(screen.getByRole('dialog')).toHaveClass('w-[min(520px,40vw)]')
  })

  it('モバイル幅ではボトムシートとして表示する', async () => {
    window.innerWidth = 390

    render(<PostComposerSheet open onOpenChange={() => {}} />)

    await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('data-side', 'bottom'))
    expect(screen.getByRole('dialog')).toHaveClass('h-[70dvh]')
  })

  it('post があるとタイトルが「投稿を編集」になる', () => {
    render(
      <PostComposerSheet
        open
        onOpenChange={() => {}}
        post={{ id: 'p1', content: '元の本文', visibility: 'public' }}
        initialScripture={{ collection: 'bofm', book: 'mosiah', chapter: 3, verses: [19] }}
      />,
    )

    expect(screen.getByText('投稿を編集')).toBeInTheDocument()
    expect(screen.queryByText('新しい投稿')).toBeNull()
  })

  it('post を PostEditor に渡す（本文が初期表示される）', () => {
    render(
      <PostComposerSheet
        open
        onOpenChange={() => {}}
        post={{ id: 'p1', content: '元の本文', visibility: 'public' }}
      />,
    )

    expect(screen.getByPlaceholderText(/感じたこと/)).toHaveValue('元の本文')
  })
})
