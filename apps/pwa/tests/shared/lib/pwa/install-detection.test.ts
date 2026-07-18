import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  isIosSafari,
  isRecentlyDismissed,
  isStandalone,
  markDismissed,
  PWA_INSTALL_DISMISSED_KEY,
  PWA_INSTALL_DISMISS_WINDOW_MS,
} from '@/shared/lib/pwa/install-detection'
import {
  ANDROID_UA,
  DESKTOP_SAFARI_UA,
  IOS_CHROME_UA,
  IOS_SAFARI_UA,
  IPAD_SAFARI_UA,
  stubUa,
} from '../../../helpers/ua'

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
    it('iPhone Safari の UA で true', () => {
      stubUa(IOS_SAFARI_UA)
      expect(isIosSafari()).toBe(true)
    })

    it('iPad Safari の UA で true', () => {
      stubUa(IPAD_SAFARI_UA)
      expect(isIosSafari()).toBe(true)
    })

    it('iOS Chrome (CriOS) では false', () => {
      stubUa(IOS_CHROME_UA)
      expect(isIosSafari()).toBe(false)
    })

    it('Android Chrome では false', () => {
      stubUa(ANDROID_UA)
      expect(isIosSafari()).toBe(false)
    })

    it('デスクトップ Safari では false', () => {
      stubUa(DESKTOP_SAFARI_UA)
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
