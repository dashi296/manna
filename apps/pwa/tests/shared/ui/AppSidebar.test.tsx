import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AppSidebar } from '@/shared/ui/AppSidebar'
import { SidebarProvider } from '@/shared/ui/sidebar'
const mockPathname = vi.fn(() => '/')
const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }))

vi.mock('@tanstack/react-router', async () => {
  const { routerMock } = await import('../../helpers/tanstack')
  // ファクトリは mockPathname の初期化前に実行されるため、ラムダで遅延参照する
  return routerMock(undefined, () => mockPathname())
})

vi.mock('@/shared/lib/auth', () => ({
  getSession: mockGetSession,
}))

async function renderSidebar() {
  const result = render(
    <SidebarProvider>
      <AppSidebar />
    </SidebarProvider>
  )
  // getSession の resolve による setState を待つ（act 警告回避）
  await screen.findByText('テスト太郎')
  return result
}

describe('AppSidebar', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/')
    mockGetSession.mockResolvedValue({
      user: {
        user_metadata: {
          full_name: 'テスト太郎',
          avatar_url: null,
        },
      },
    })
  })

  it('5つのナビリンクをレンダーする', async () => {
    await renderSidebar()
    expect(screen.getByRole('link', { name: /フィード/ })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /聖典/ })).toHaveAttribute('href', '/scriptures')
    expect(screen.getByRole('link', { name: /投稿する/ })).toHaveAttribute('href', '/posts/new')
    expect(screen.getByRole('link', { name: /通知/ })).toHaveAttribute('href', '/notifications')
    expect(screen.getByRole('link', { name: /プロフィール/ })).toHaveAttribute('href', '/profile')
  })

  it('現在のパスに対応するリンクが data-active を持つ', async () => {
    mockPathname.mockReturnValue('/scriptures/bofm')
    await renderSidebar()
    const scriptureLink = screen.getByRole('link', { name: /聖典/ })
    expect(scriptureLink).toHaveAttribute('data-active')
    const feedLink = screen.getByRole('link', { name: /フィード/ })
    expect(feedLink).not.toHaveAttribute('data-active')
  })

  it('サイドバー開閉トリガーをレンダーする', async () => {
    await renderSidebar()
    // ヘッダーの SidebarTrigger（vendored の SidebarRail も同名なので厳密数は問わない）
    const toggles = screen.getAllByRole('button', { name: /Toggle Sidebar/i })
    expect(toggles.length).toBeGreaterThanOrEqual(1)
  })

  it('ログイン済みユーザーの表示名がプロフィールへのリンクとしてフッターに表示される', async () => {
    await renderSidebar()
    const footerLink = screen.getByRole('link', { name: 'テスト太郎' })
    expect(footerLink).toHaveAttribute('href', '/profile')
  })

  it('未ログイン時はフッターのユーザー表示をレンダーしない', async () => {
    mockGetSession.mockResolvedValue(null)
    render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    )
    // getSession の resolve を待ってからフッター不在を検証する
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled())
    expect(document.querySelector('[data-slot="sidebar-footer"]')).toBeNull()
    // ナビ自体は未ログインでも表示される
    expect(screen.getByRole('link', { name: /聖典/ })).toBeInTheDocument()
  })
})
