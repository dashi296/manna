import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '@/shared/lib/queryClient'
import { NotFoundPage } from '@/widgets/not-found'

const mockGetSession = vi.fn()

vi.mock('@/shared/lib/auth', () => ({
  getSession: () => mockGetSession(),
  signOut: vi.fn(),
}))

vi.mock('@tanstack/react-router', async () =>
  (await import('../../helpers/tanstack')).routerMock(),
)

// セッションはクエリキャッシュに載るため、テストごとに新しい QueryClient を使う
const renderPage = () =>
  render(
    <QueryClientProvider client={createQueryClient()}>
      <NotFoundPage />
    </QueryClientProvider>,
  )

describe('NotFoundPage', () => {
  beforeEach(() => {
    mockGetSession.mockReset().mockResolvedValue(null)
  })

  it('見つからなかったことを伝える', () => {
    renderPage()
    expect(
      screen.getByRole('heading', { level: 1, name: 'ページが見つかりません' }),
    ).toBeInTheDocument()
  })

  it('フィードへ戻るリンクを表示する', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'フィードへ戻る' })).toHaveAttribute('href', '/')
  })

  it('ログイン中ならログアウトボタンを表示する', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } })
    renderPage()
    expect(await screen.findByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
  })

  it('未ログインならログアウトボタンを表示しない', async () => {
    renderPage()
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'ログアウト' })).toBeNull()
  })

  // セッション取得が失敗しても 404 画面自体は出したい（このページは復帰の最終手段）
  it('セッション取得が失敗しても本文は表示する', async () => {
    mockGetSession.mockRejectedValue(new Error('network'))
    renderPage()
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled())
    expect(screen.getByRole('link', { name: 'フィードへ戻る' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ログアウト' })).toBeNull()
  })
})
