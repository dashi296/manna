import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routeComponent } from '../../helpers/tanstack'

vi.mock('@tanstack/react-router', async () => {
  const { routerMock } = await import('../../helpers/tanstack')
  return routerMock()
})

let BookmarksPage: React.ComponentType

beforeAll(async () => {
  const mod = await import('@/pages/bookmarks/index')
  BookmarksPage = routeComponent(mod)
})

describe('BookmarksPage', () => {
  beforeEach(async () => {
    localStorage.clear()
    const { useBookmarkStore } = await import('@/entities/bookmark')
    useBookmarkStore.setState({ readingPosition: null, bookmarks: [] })
  })

  it('続きを読む位置がなければ空状態を表示する', () => {
    render(<BookmarksPage />)
    expect(screen.getByText('聖典を読むとここに続きが表示されます。')).toBeInTheDocument()
  })

  it('続きを読む位置があればカードを表示する', async () => {
    const { useBookmarkStore } = await import('@/entities/bookmark')
    useBookmarkStore.setState({
      readingPosition: { collection: 'bofm', book: '1-ne', chapter: 3 },
    })
    render(<BookmarksPage />)
    expect(screen.getByText('第1ニーファイ書 第3章')).toBeInTheDocument()
  })

  it('栞がなければ空状態を表示する', () => {
    render(<BookmarksPage />)
    expect(
      screen.getByText('栞はまだありません。聖典を読んでいるときに 🔖 をタップすると追加されます。'),
    ).toBeInTheDocument()
  })

  it('栞一覧を新しい順に表示する', async () => {
    const { useBookmarkStore } = await import('@/entities/bookmark')
    useBookmarkStore.setState({
      bookmarks: [
        { id: 'b2', collection: 'bofm', book: '1-ne', chapter: 2, createdAt: '2026-07-02T00:00:00.000Z' },
        { id: 'b1', collection: 'bofm', book: '1-ne', chapter: 1, createdAt: '2026-07-01T00:00:00.000Z' },
      ],
    })
    render(<BookmarksPage />)
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('第1ニーファイ書 第2章')
    expect(items[1]).toHaveTextContent('第1ニーファイ書 第1章')
  })

  it('削除ボタンで栞が消える', async () => {
    const { useBookmarkStore } = await import('@/entities/bookmark')
    useBookmarkStore.setState({
      bookmarks: [
        { id: 'b1', collection: 'bofm', book: '1-ne', chapter: 1, createdAt: '2026-07-01T00:00:00.000Z' },
      ],
    })
    const user = userEvent.setup()
    render(<BookmarksPage />)
    await user.click(screen.getByRole('button', { name: '栞を削除' }))
    expect(useBookmarkStore.getState().bookmarks).toHaveLength(0)
  })
})
