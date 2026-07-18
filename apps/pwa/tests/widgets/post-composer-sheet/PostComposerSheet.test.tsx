import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PostComposerSheet } from '@/widgets/post-composer-sheet'

const mockInsert = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: () => ({ insert: mockInsert }),
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  },
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

describe('PostComposerSheet', () => {
  beforeEach(() => {
    localStorage.clear()
    mockInsert.mockClear()
  })

  it('open=false ではシート内容が描画されない', () => {
    render(
      <PostComposerSheet open={false} onOpenChange={() => {}} />,
    )
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

  it('initialScripture 未指定なら「新しい投稿」タイトル', () => {
    render(<PostComposerSheet open onOpenChange={() => {}} />)
    expect(screen.getByText('新しい投稿')).toBeInTheDocument()
  })
})
