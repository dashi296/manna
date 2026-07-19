import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  SELECTED_USER_STORAGE_KEY,
  useSelectedUserStore,
} from '@/features/select-verse-view/model/selectedUserStore'

describe('useSelectedUserStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useSelectedUserStore.setState({ selectedUserId: null })
  })

  it('初期値は null', () => {
    const { result } = renderHook(() => useSelectedUserStore())
    expect(result.current.selectedUserId).toBeNull()
  })

  it('select() で選択ユーザーが設定される', () => {
    const { result } = renderHook(() => useSelectedUserStore())
    act(() => result.current.select('user-a'))
    expect(result.current.selectedUserId).toBe('user-a')
  })

  it('clear() で null に戻る', () => {
    const { result } = renderHook(() => useSelectedUserStore())
    act(() => result.current.select('user-a'))
    act(() => result.current.clear())
    expect(result.current.selectedUserId).toBeNull()
  })

  it('選択が localStorage に永続化される', () => {
    const { result } = renderHook(() => useSelectedUserStore())
    act(() => result.current.select('user-b'))
    const stored = localStorage.getItem(SELECTED_USER_STORAGE_KEY)
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.selectedUserId).toBe('user-b')
  })
})
