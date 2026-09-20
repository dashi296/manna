// マッチャを登録する副作用 import。値は受け取らない
// oxlint-disable-next-line import/no-unassigned-import
import '@testing-library/jest-dom'

// jsdom は ResizeObserver を実装していない（InstallPwaBanner の高さ計測が依存）
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// jsdom は matchMedia を実装していない（useIsMobile が依存）
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList
}

// jsdom は scrollIntoView を実装していない（章ページがシートを開いた節へスクロールする）
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// jsdom は requestIdleCallback を実装していない（隣章の先読みが「アイドルまで待つ」
// 判断に使う）。本番のフォールバックは固定待ちのため、テストが待ち時間に依存する
if (!globalThis.requestIdleCallback) {
  globalThis.requestIdleCallback = ((cb: IdleRequestCallback) =>
    setTimeout(
      () => cb({ didTimeout: false, timeRemaining: () => 0 }),
      0,
    ) as unknown as number) as typeof requestIdleCallback
  globalThis.cancelIdleCallback = ((handle: number) =>
    clearTimeout(handle as unknown as NodeJS.Timeout)) as typeof cancelIdleCallback
}
