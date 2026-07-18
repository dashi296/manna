import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  isIosSafari,
  isRecentlyDismissed,
  isStandalone,
  markDismissed,
  PWA_INSTALL_DISMISSED_KEY,
  PWA_INSTALL_DISMISS_WINDOW_MS,
} from '@/shared/lib/pwa/install-detection'

describe('install-detection', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('isStandalone', () => {
    it('display-mode: standalone にマッチする場合 true', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query) =>
          ({
            matches: query === '(display-mode: standalone)',
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
          }) as unknown as MediaQueryList,
      )
      expect(isStandalone()).toBe(true)
    })

    it('navigator.standalone が true の場合 true', () => {
      vi.stubGlobal('navigator', { ...window.navigator, standalone: true })
      expect(isStandalone()).toBe(true)
    })

    it('どちらでもない場合 false', () => {
      expect(isStandalone()).toBe(false)
    })
  })

  describe('isIosSafari', () => {
    const setUa = (ua: string) => {
      vi.stubGlobal('navigator', { ...window.navigator, userAgent: ua })
    }

    it('iPhone Safari の UA で true', () => {
      setUa(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      )
      expect(isIosSafari()).toBe(true)
    })

    it('iPad Safari の UA で true', () => {
      setUa(
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      )
      expect(isIosSafari()).toBe(true)
    })

    it('iOS Chrome (CriOS) では false', () => {
      setUa(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0 Mobile/15E148 Safari/604.1',
      )
      expect(isIosSafari()).toBe(false)
    })

    it('Android Chrome では false', () => {
      setUa(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      )
      expect(isIosSafari()).toBe(false)
    })

    it('デスクトップ Safari では false', () => {
      setUa(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      )
      expect(isIosSafari()).toBe(false)
    })
  })

  describe('isRecentlyDismissed', () => {
    it('localStorage に値がなければ false', () => {
      expect(isRecentlyDismissed()).toBe(false)
    })

    it('7 日以内なら true', () => {
      const now = 1_800_000_000_000
      window.localStorage.setItem(
        PWA_INSTALL_DISMISSED_KEY,
        String(now - PWA_INSTALL_DISMISS_WINDOW_MS + 1),
      )
      expect(isRecentlyDismissed(now)).toBe(true)
    })

    it('7 日ちょうど経過なら false', () => {
      const now = 1_800_000_000_000
      window.localStorage.setItem(
        PWA_INSTALL_DISMISSED_KEY,
        String(now - PWA_INSTALL_DISMISS_WINDOW_MS),
      )
      expect(isRecentlyDismissed(now)).toBe(false)
    })

    it('壊れた値なら false', () => {
      window.localStorage.setItem(PWA_INSTALL_DISMISSED_KEY, 'not-a-number')
      expect(isRecentlyDismissed()).toBe(false)
    })
  })

  describe('markDismissed', () => {
    it('現在時刻を localStorage に保存する', () => {
      markDismissed(1_800_000_000_000)
      expect(window.localStorage.getItem(PWA_INSTALL_DISMISSED_KEY)).toBe(
        '1800000000000',
      )
    })
  })
})
