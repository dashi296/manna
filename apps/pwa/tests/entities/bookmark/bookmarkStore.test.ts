import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  BOOKMARK_STORAGE_KEY,
  useBookmarkStore,
} from '@/entities/bookmark/model/bookmarkStore'

const LOC_A = { collection: 'bofm', book: '1-ne', chapter: 1 }
const LOC_B = { collection: 'bofm', book: '1-ne', chapter: 2 }

describe('useBookmarkStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useBookmarkStore.setState({ readingPosition: null, bookmarks: [] })
  })

  it('初期値は readingPosition: null, bookmarks: []', () => {
    const { result } = renderHook(() => useBookmarkStore())
    expect(result.current.readingPosition).toBeNull()
    expect(result.current.bookmarks).toEqual([])
  })

  it('setReadingPosition() で続きを読む位置が上書きされる', () => {
    const { result } = renderHook(() => useBookmarkStore())
    act(() => result.current.setReadingPosition(LOC_A))
    expect(result.current.readingPosition).toEqual(LOC_A)
    act(() => result.current.setReadingPosition(LOC_B))
    expect(result.current.readingPosition).toEqual(LOC_B)
  })

  it('toggleBookmark() で栞が先頭に追加される', () => {
    const { result } = renderHook(() => useBookmarkStore())
    act(() => result.current.toggleBookmark(LOC_A))
    act(() => result.current.toggleBookmark(LOC_B))
    expect(result.current.bookmarks).toHaveLength(2)
    expect(result.current.bookmarks[0]).toMatchObject(LOC_B)
    expect(result.current.bookmarks[1]).toMatchObject(LOC_A)
  })

  it('同じ章に toggleBookmark() すると栞が外れる', () => {
    const { result } = renderHook(() => useBookmarkStore())
    act(() => result.current.toggleBookmark(LOC_A))
    expect(result.current.bookmarks).toHaveLength(1)
    act(() => result.current.toggleBookmark(LOC_A))
    expect(result.current.bookmarks).toHaveLength(0)
  })

  it('removeBookmark() で id 指定の栞が削除される', () => {
    const { result } = renderHook(() => useBookmarkStore())
    act(() => result.current.toggleBookmark(LOC_A))
    const id = result.current.bookmarks[0].id
    act(() => result.current.removeBookmark(id))
    expect(result.current.bookmarks).toHaveLength(0)
  })

  it('bookmarks が localStorage に永続化される', () => {
    const { result } = renderHook(() => useBookmarkStore())
    act(() => result.current.toggleBookmark(LOC_A))
    const stored = localStorage.getItem(BOOKMARK_STORAGE_KEY)
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.bookmarks).toHaveLength(1)
    expect(parsed.state.bookmarks[0]).toMatchObject(LOC_A)
  })
})
