export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in window.navigator)) return
  window.navigator.serviceWorker.register('/sw.js').catch(() => {
    // localhost の http 環境や制限された環境では登録できない。
    // その場合 beforeinstallprompt は来ないので、バナーも自然に出ない。
  })
}
