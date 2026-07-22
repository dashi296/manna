import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BookmarkButton } from '@/features/toggle-bookmark'
import { useBookmarkStore } from '@/entities/bookmark'

const LOC = { collection: 'bofm', book: '1-ne', chapter: 1 }

describe('BookmarkButton', () => {
  beforeEach(() => {
    localStorage.clear()
    useBookmarkStore.setState({ readingPosition: null, bookmarks: [] })
  })

  it('未栞状態では「栞に追加」ボタンを表示する', () => {
    render(<BookmarkButton loc={LOC} />)
    expect(screen.getByRole('button', { name: '栞に追加' })).toBeInTheDocument()
  })

  it('クリックすると栞済みになり「栞から削除」に切り替わる', async () => {
    const user = userEvent.setup()
    render(<BookmarkButton loc={LOC} />)
    await user.click(screen.getByRole('button', { name: '栞に追加' }))
    expect(await screen.findByRole('button', { name: '栞から削除' })).toBeInTheDocument()
    expect(useBookmarkStore.getState().bookmarks).toHaveLength(1)
  })

  it('栞済み状態でクリックすると解除される', async () => {
    useBookmarkStore.setState({
      bookmarks: [{ ...LOC, id: 'b1', createdAt: '2026-07-01T00:00:00.000Z' }],
    })
    const user = userEvent.setup()
    render(<BookmarkButton loc={LOC} />)
    await user.click(screen.getByRole('button', { name: '栞から削除' }))
    expect(await screen.findByRole('button', { name: '栞に追加' })).toBeInTheDocument()
    expect(useBookmarkStore.getState().bookmarks).toHaveLength(0)
  })
})
