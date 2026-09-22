import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
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

const Probe = () => createElement('span', { 'data-testid': 'v' }, String(useIsMobile()))

describe('useIsMobile', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('innerWidth < 1024 のとき true を返す（タブレット帯もサイドバーの lg 境界と一致して mobile 扱い）', () => {
    setupMatchMedia(800)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('innerWidth >= 1024 のとき false を返す', () => {
    setupMatchMedia(1024)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('初回描画の時点で正しい値を返す（effect の後まで待たない）', () => {
    setupMatchMedia(800)
    const seen: boolean[] = []
    renderHook(() => {
      const value = useIsMobile()
      seen.push(value)
      return value
    })
    // 1 回目の描画が false だと、モバイルでも一度デスクトップ用の配置で DOM に入る
    expect(seen[0]).toBe(true)
  })

  it('SSR は幅を持たないので false を返し、ハイドレーションで実際の幅に移る', async () => {
    setupMatchMedia(390)

    const container = document.createElement('div')
    container.innerHTML = renderToString(createElement(Probe))
    document.body.append(container)
    const value = () => container.querySelector('[data-testid="v"]')?.textContent

    // サーバーには幅が無い。getServerSnapshot の false がそのまま出る
    expect(value()).toBe('false')

    const errors: unknown[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args))
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, createElement(Probe))
    })
    spy.mockRestore()

    // ハイドレーション自体は SSR と同じ false で始まるので不一致の警告は出ない
    expect(errors).toEqual([])
    expect(value()).toBe('true')

    await act(async () => root?.unmount())
    container.remove()
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
