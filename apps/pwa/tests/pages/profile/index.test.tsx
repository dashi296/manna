import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { routeComponent } from '../../helpers/tanstack'

const loaderData = vi.fn()

vi.mock('@tanstack/react-router', async () =>
  (await import('../../helpers/tanstack')).routerMock(() => loaderData()),
)

vi.mock('@tanstack/react-start', async () => (await import('../../helpers/tanstack')).startMock())

const base = {
  profile: { id: 'u2', display_name: 'テスト太郎', avatar_url: null, bio: null },
  posts: [],
  currentUserId: null as string | null,
  isFollowing: false,
  familyStatus: 'none',
  followerCount: 3,
  followingCount: 5,
}

const renderPage = async (overrides: Partial<typeof base> = {}) => {
  loaderData.mockReturnValue({ ...base, ...overrides })
  const ProfilePage = routeComponent(await import('@/pages/profile/$userId/index'))
  return render(<ProfilePage />)
}

describe('ProfilePage', () => {
  it('表示名とフォロワー数/フォロー中数を表示する', async () => {
    await renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'テスト太郎' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'テスト太郎' })).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('フォロワー数から一覧ページへのリンクを張る', async () => {
    await renderPage()
    expect(screen.getByRole('link', { name: /フォロワー/ })).toHaveAttribute(
      'href',
      '/profile/u2/connections?tab=followers',
    )
  })

  it('フォロー中数から一覧ページへのリンクを張る', async () => {
    await renderPage()
    expect(screen.getByRole('link', { name: /フォロー中/ })).toHaveAttribute(
      'href',
      '/profile/u2/connections?tab=following',
    )
  })

  it('自分のプロフィールではログアウトボタンを表示する', async () => {
    await renderPage({ currentUserId: 'u2' })
    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
  })

  it('他人のプロフィールにはログアウトボタンを表示しない', async () => {
    await renderPage({ currentUserId: 'me' })
    expect(screen.queryByRole('button', { name: 'ログアウト' })).toBeNull()
  })
})
