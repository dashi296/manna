import { describe, it, expect, vi, afterEach } from 'vitest'
import { registerServiceWorker } from '@/shared/lib/pwa/register-sw'

describe('registerServiceWorker', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('serviceWorker が使えるとき /sw.js を登録する', () => {
    const register = vi.fn(() => Promise.resolve({} as ServiceWorkerRegistration))
    const nav = { ...window.navigator }
    Object.defineProperty(nav, 'serviceWorker', {
      value: { register },
      configurable: true,
    })
    vi.stubGlobal('navigator', nav)

    registerServiceWorker()

    expect(register).toHaveBeenCalledWith('/sw.js')
  })

  it('serviceWorker がない環境では何もしない', () => {
    const { serviceWorker: _sw, ...navWithoutSw } = window.navigator
    void _sw
    vi.stubGlobal('navigator', navWithoutSw)

    expect(() => registerServiceWorker()).not.toThrow()
  })

  it('登録失敗時に例外を投げない', async () => {
    const register = vi.fn(() => Promise.reject(new Error('boom')))
    const nav = { ...window.navigator }
    Object.defineProperty(nav, 'serviceWorker', {
      value: { register },
      configurable: true,
    })
    vi.stubGlobal('navigator', nav)

    registerServiceWorker()
    await expect(Promise.resolve()).resolves.toBeUndefined()
    expect(register).toHaveBeenCalled()
  })
})
