export const PWA_INSTALL_DISMISSED_KEY = 'manna:pwa-install-dismissed-at'
export const PWA_INSTALL_DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

const IOS_DEVICE_RE = /iPhone|iPad|iPod/
const MAC_UA_RE = /Macintosh/
const NON_SAFARI_RE = /CriOS|FxiOS|EdgiOS|Chrome|Chromium|Firefox|Edg\//

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true
}

export function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator
  const ua = nav.userAgent
  if (NON_SAFARI_RE.test(ua)) return false
  if (IOS_DEVICE_RE.test(ua)) return true
  // iPadOS 13+ Safari はデスクトップモードで Macintosh UA を返す。マルチタッチが指紋になる。
  return MAC_UA_RE.test(ua) && nav.maxTouchPoints > 1
}

export function isRecentlyDismissed(now: number = Date.now()): boolean {
  if (typeof window === 'undefined') return false
  const raw = window.localStorage.getItem(PWA_INSTALL_DISMISSED_KEY)
  if (!raw) return false
  const dismissedAt = Number(raw)
  if (!Number.isFinite(dismissedAt)) return false
  return now - dismissedAt < PWA_INSTALL_DISMISS_WINDOW_MS
}

export function markDismissed(now: number = Date.now()): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PWA_INSTALL_DISMISSED_KEY, String(now))
}
