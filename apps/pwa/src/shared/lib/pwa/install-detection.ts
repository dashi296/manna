export const PWA_INSTALL_DISMISSED_KEY = 'manna:pwa-install-dismissed-at'
export const PWA_INSTALL_DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

const IOS_DEVICE_RE = /iPhone|iPad|iPod/
const NON_SAFARI_IOS_RE = /CriOS|FxiOS|EdgiOS/

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true
}

export function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  return IOS_DEVICE_RE.test(ua) && !NON_SAFARI_IOS_RE.test(ua)
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
