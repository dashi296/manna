import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { routeComponent } from '../../helpers/tanstack'
import { renderWithQueryClient } from '../../helpers/query'

const mockFetchProfileData = vi.fn()

vi.mock('@tanstack/react-router', async () =>
  (await import('../../helpers/tanstack')).routerMock(undefined, undefined, undefined, {
    useParams: () => ({ userId: 'u2' }),
  }),
)

vi.mock('@tanstack/react-start', async () =>
  (await import('../../helpers/tanstack')).startMock(mockFetchProfileData),
)

vi.mock('@/shared/lib/supabase', () => ({
  supabase: { from: () => ({ insert: vi.fn(), update: vi.fn(), delete: vi.fn() }) },
}))

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
  mockFetchProfileData.mockResolvedValue({ ...base, ...overrides })
  const ProfilePage = routeComponent(await import('@/pages/profile/$userId/index'))
  const utils = renderWithQueryClient(() => <ProfilePage />)
  // loader が先にキャッシュを埋めるのは本番だけなので、ここでは取得完了を待つ
  await screen.findByRole('heading', { level: 2, name: 'テスト太郎' })
  return utils
}

describe('ProfilePage', () => {
  beforeEach(() => {
    mockFetchProfileData.mockReset()
  })

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

  it('他人のプロフィールにはフォローとファミリーの操作を表示する', async () => {
    await renderPage({ currentUserId: 'me' })
    expect(screen.getByRole('button', { name: 'フォロー' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ファミリーに追加' })).toBeInTheDocument()
  })

  it('userId ごとに別のクエリで取得する', async () => {
    const { client } = await renderPage()
    expect(client.getQueryData(['profile', 'u2'])).toMatchObject({ followerCount: 3 })
  })
})
