import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InstallPwaBanner } from '@/shared/ui/InstallPwaBanner'
import { PWA_INSTALL_DISMISSED_KEY } from '@/shared/lib/pwa'

const IOS_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

const setUa = (ua: string) => {
  vi.stubGlobal('navigator', { ...window.navigator, userAgent: ua })
}

const mockRegister = vi.fn(() => Promise.resolve({} as ServiceWorkerRegistration))

const setServiceWorker = (present = true) => {
  const nav = { ...window.navigator, userAgent: window.navigator.userAgent }
  if (present) {
    Object.defineProperty(nav, 'serviceWorker', {
      value: { register: mockRegister },
      configurable: true,
    })
  }
  vi.stubGlobal('navigator', nav)
}

function fireBeforeInstallPrompt() {
  const promptFn = vi.fn(() => Promise.resolve())
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
  event.prompt = promptFn
  event.userChoice = Promise.resolve({ outcome: 'accepted' as const })
  act(() => {
    window.dispatchEvent(event)
  })
  return promptFn
}

describe('InstallPwaBanner', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mockRegister.mockClear()
    setUa(ANDROID_UA)
    setServiceWorker(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('standalone なら何も表示せず、SW も登録しない', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query === '(display-mode: standalone)',
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    )
    render(<InstallPwaBanner />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('7 日以内に dismiss 済みなら表示しない', () => {
    window.localStorage.setItem(PWA_INSTALL_DISMISSED_KEY, String(Date.now()))
    setUa(IOS_SAFARI_UA)
    render(<InstallPwaBanner />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('iOS Safari で開くとバナーが表示される', () => {
    setUa(IOS_SAFARI_UA)
    render(<InstallPwaBanner />)
    expect(
      screen.getByRole('dialog', { name: /アプリのインストール案内/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '追加' })).toBeInTheDocument()
  })

  it('Chromium で beforeinstallprompt を受け取るとバナーが表示される', () => {
    render(<InstallPwaBanner />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireBeforeInstallPrompt()
    expect(
      screen.getByRole('dialog', { name: /アプリのインストール案内/ }),
    ).toBeInTheDocument()
  })

  it('マウント時に Service Worker を登録する', () => {
    render(<InstallPwaBanner />)
    expect(mockRegister).toHaveBeenCalledWith('/sw.js')
  })

  it('閉じるボタンでバナーが消え、localStorage に dismiss 時刻が保存される', async () => {
    const user = userEvent.setup()
    setUa(IOS_SAFARI_UA)
    render(<InstallPwaBanner />)
    await user.click(screen.getByRole('button', { name: '閉じる' }))
    expect(screen.queryByRole('dialog', { name: /アプリのインストール案内/ }))
      .toBeNull()
    expect(window.localStorage.getItem(PWA_INSTALL_DISMISSED_KEY)).not.toBeNull()
  })

  it('Chromium の「追加」で deferredPrompt.prompt() が呼ばれる', async () => {
    const user = userEvent.setup()
    render(<InstallPwaBanner />)
    const promptFn = fireBeforeInstallPrompt()
    await user.click(screen.getByRole('button', { name: '追加' }))
    expect(promptFn).toHaveBeenCalled()
  })

  it('iOS の「追加」で手順シートが開く', async () => {
    const user = userEvent.setup()
    setUa(IOS_SAFARI_UA)
    render(<InstallPwaBanner />)
    await user.click(screen.getByRole('button', { name: '追加' }))
    expect(
      await screen.findByRole('heading', { name: 'ホーム画面に追加' }),
    ).toBeInTheDocument()
  })
})
