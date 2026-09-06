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

// jsdom は document.fonts を実装していない（章ページがフォント適用後にスクロールする）
if (!document.fonts) {
  Object.defineProperty(document, 'fonts', {
    value: { ready: Promise.resolve(), status: 'loaded' },
    configurable: true,
  })
}
