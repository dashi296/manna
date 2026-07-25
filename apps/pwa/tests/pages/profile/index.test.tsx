import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { routeComponent } from '../../helpers/tanstack'

vi.mock('@tanstack/react-router', async () =>
  (await import('../../helpers/tanstack')).routerMock(() => ({
    profile: { id: 'u2', display_name: 'テスト太郎', avatar_url: null, bio: null },
    posts: [],
    currentUserId: null,
    isFollowing: false,
    familyStatus: 'none',
    followerCount: 3,
    followingCount: 5,
  })),
)

vi.mock('@tanstack/react-start', async () => (await import('../../helpers/tanstack')).startMock())

describe('ProfilePage', () => {
  it('表示名とフォロワー数/フォロー中数を表示する', async () => {
    const ProfilePage = routeComponent(await import('@/pages/profile/$userId/index'))
    render(<ProfilePage />)
    expect(screen.getAllByText('テスト太郎').length).toBeGreaterThan(0)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})
