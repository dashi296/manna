import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  BILINGUAL_DISPLAY_STORAGE_KEY,
  useBilingualDisplayStore,
} from '@/entities/bilingual-display/model/bilingualDisplayStore'

describe('useBilingualDisplayStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useBilingualDisplayStore.setState({ enabled: false })
  })

  it('初期値は enabled: false', () => {
    const { result } = renderHook(() => useBilingualDisplayStore())
    expect(result.current.enabled).toBe(false)
  })

  it('toggle() で enabled が反転する', () => {
    const { result } = renderHook(() => useBilingualDisplayStore())
    act(() => result.current.toggle())
    expect(result.current.enabled).toBe(true)
    act(() => result.current.toggle())
    expect(result.current.enabled).toBe(false)
  })

  it('enabled が localStorage に永続化される', () => {
    const { result } = renderHook(() => useBilingualDisplayStore())
    act(() => result.current.toggle())
    const stored = localStorage.getItem(BILINGUAL_DISPLAY_STORAGE_KEY)
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.enabled).toBe(true)
  })
})
