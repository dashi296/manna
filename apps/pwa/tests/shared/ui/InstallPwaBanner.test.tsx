import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InstallPwaBanner } from '@/shared/ui/InstallPwaBanner'
import { PWA_INSTALL_DISMISSED_KEY } from '@/shared/lib/pwa'
import { ANDROID_UA, IOS_SAFARI_UA, stubUa } from '../../helpers/ua'

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

const BANNER_LABEL = /アプリのインストール案内/

describe('InstallPwaBanner', () => {
  beforeEach(() => {
    window.localStorage.clear()
    stubUa(ANDROID_UA)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('standalone なら表示しない', () => {
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
    expect(screen.queryByRole('region', { name: BANNER_LABEL })).toBeNull()
  })

  it('7 日以内に dismiss 済みなら表示しない', () => {
    window.localStorage.setItem(PWA_INSTALL_DISMISSED_KEY, String(Date.now()))
    stubUa(IOS_SAFARI_UA)
    render(<InstallPwaBanner />)
    expect(screen.queryByRole('region', { name: BANNER_LABEL })).toBeNull()
  })

  it('iOS Safari で開くとバナーが表示される', () => {
    stubUa(IOS_SAFARI_UA)
    render(<InstallPwaBanner />)
    expect(screen.getByRole('region', { name: BANNER_LABEL })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '追加' })).toBeInTheDocument()
  })

  it('Chromium で beforeinstallprompt を受け取るとバナーが表示される', () => {
    render(<InstallPwaBanner />)
    expect(screen.queryByRole('region', { name: BANNER_LABEL })).toBeNull()
    fireBeforeInstallPrompt()
    expect(screen.getByRole('region', { name: BANNER_LABEL })).toBeInTheDocument()
  })

  it('閉じるボタンでバナーが消え、localStorage に dismiss 時刻が保存される', async () => {
    const user = userEvent.setup()
    stubUa(IOS_SAFARI_UA)
    render(<InstallPwaBanner />)
    await user.click(screen.getByRole('button', { name: '閉じる' }))
    expect(screen.queryByRole('region', { name: BANNER_LABEL })).toBeNull()
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
    stubUa(IOS_SAFARI_UA)
    render(<InstallPwaBanner />)
    await user.click(screen.getByRole('button', { name: '追加' }))
    expect(
      await screen.findByRole('heading', { name: 'ホーム画面に追加' }),
    ).toBeInTheDocument()
  })

  it('BottomNavの実高さ分のオフセットクラスが付与される', () => {
    stubUa(IOS_SAFARI_UA)
    render(<InstallPwaBanner />)
    const banner = screen.getByRole('region', { name: BANNER_LABEL })
    expect(banner.className).toContain('bottom-[var(--bottom-nav-h)]')
  })
})
