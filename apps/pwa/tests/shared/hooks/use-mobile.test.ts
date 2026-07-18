import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from '@/shared/hooks/use-mobile'

function setupMatchMedia(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
  const listeners: (() => void)[] = []
  window.matchMedia = vi.fn().mockImplementation(() => ({
    addEventListener: (_: string, cb: () => void) => listeners.push(cb),
    removeEventListener: () => {},
  }))
  return { triggerChange: () => listeners.forEach((cb) => cb()) }
}

describe('useIsMobile', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('innerWidth < 1024 のとき true を返す', () => {
    setupMatchMedia(375)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('タブレット帯（800px）も mobile 扱いになる（サイドバーの lg 境界と一致）', () => {
    setupMatchMedia(800)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('innerWidth >= 1024 のとき false を返す', () => {
    setupMatchMedia(1024)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('matchMedia の change イベントで再評価する', () => {
    const { triggerChange } = setupMatchMedia(1024)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 375 })
      triggerChange()
    })
    expect(result.current).toBe(true)
  })
})
