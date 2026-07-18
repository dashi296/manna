import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FollowButton } from '@/features/follow-user'

const mockInsert = vi.fn().mockResolvedValue({ error: null })
const mockDelete = vi.fn(() => ({
  eq: vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: null }),
  })),
}))

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: mockInsert,
      delete: mockDelete,
    }),
  },
}))

describe('FollowButton', () => {
  beforeEach(() => {
    mockInsert.mockClear()
    mockDelete.mockClear()
  })

  it('未フォロー時に「フォロー」ボタンを表示する', () => {
    render(<FollowButton targetUserId="u2" currentUserId="u1" initialFollowing={false} />)
    expect(screen.getByRole('button', { name: 'フォロー' })).toBeInTheDocument()
  })

  it('フォロー済み時に「フォロー中」ボタンを表示する', () => {
    render(<FollowButton targetUserId="u2" currentUserId="u1" initialFollowing={true} />)
    expect(screen.getByRole('button', { name: 'フォロー中' })).toBeInTheDocument()
  })

  it('クリックでフォロー→フォロー中に切り替わる', async () => {
    render(<FollowButton targetUserId="u2" currentUserId="u1" initialFollowing={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'フォロー' }))
    expect(await screen.findByRole('button', { name: 'フォロー中' })).toBeInTheDocument()
  })
})
