import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppSidebar } from '@/shared/ui/AppSidebar'
import { SidebarProvider } from '@/shared/ui/sidebar'

const mockPathname = vi.fn(() => '/')

vi.mock('@tanstack/react-router', () => ({
  useRouterState: () => ({ location: { pathname: mockPathname() } }),
  Link: ({ to, children, className, ...props }: { to: string; children?: React.ReactNode; className?: string; [key: string]: unknown }) => (
    <a href={to} className={className} {...props}>{children}</a>
  ),
}))

vi.mock('@/shared/lib/auth', () => ({
  getSession: vi.fn(() =>
    Promise.resolve({
      user: {
        user_metadata: {
          full_name: 'テスト太郎',
          avatar_url: null,
        },
      },
    })
  ),
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
    // SidebarTrigger と SidebarRail の両方が Toggle Sidebar ボタン
    const toggles = screen.getAllByRole('button', { name: /Toggle Sidebar/i })
    expect(toggles).toHaveLength(2)
  })

  it('ログイン済みユーザーの表示名がプロフィールへのリンクとしてフッターに表示される', async () => {
    await renderSidebar()
    const footerLink = screen.getByRole('link', { name: 'テスト太郎' })
    expect(footerLink).toHaveAttribute('href', '/profile')
  })
})
