import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { routeComponent } from '../../helpers/tanstack'

const loaderData = vi.fn()

vi.mock('@tanstack/react-router', async () =>
  (await import('../../helpers/tanstack')).routerMock(() => loaderData()),
)

vi.mock('@tanstack/react-start', async () => (await import('../../helpers/tanstack')).startMock())

vi.mock('@/shared/lib/supabase', () => ({
  supabase: { from: () => ({ insert: vi.fn(), delete: vi.fn() }) },
}))

const row = (id: string, name: string, isFollowingByMe = false) => ({
  user: { id, display_name: name, avatar_url: null },
  isFollowingByMe,
})

const base = {
  userId: 'owner',
  tab: 'followers' as const,
  currentUserId: 'me',
  rows: [] as ReturnType<typeof row>[],
  nextCursor: null,
}

const renderPage = async () => {
  const ConnectionsPage = routeComponent(await import('@/pages/profile/$userId/connections'))
  render(<ConnectionsPage />)
}

describe('ConnectionsPage', () => {
  it('フォロワータブでユーザー一覧を表示する', async () => {
    loaderData.mockReturnValue({ ...base, rows: [row('u1', '山田花子'), row('u2', '佐藤太郎')] })
    await renderPage()
    expect(screen.getByText('山田花子')).toBeInTheDocument()
    expect(screen.getByText('佐藤太郎')).toBeInTheDocument()
  })

  it('フォロー中タブのデータではフォロー中の一覧を表示する', async () => {
    loaderData.mockReturnValue({ ...base, tab: 'following', rows: [row('u3', '鈴木次郎')] })
    await renderPage()
    expect(screen.getByText('鈴木次郎')).toBeInTheDocument()
  })

  it('自分自身の行にはフォローボタンを表示しない', async () => {
    loaderData.mockReturnValue({ ...base, rows: [row('me', '自分'), row('u1', '山田花子')] })
    await renderPage()
    expect(screen.getAllByRole('button', { name: 'フォロー' })).toHaveLength(1)
  })

  it('0件のときは空状態を表示する', async () => {
    loaderData.mockReturnValue({ ...base, rows: [] })
    await renderPage()
    expect(screen.getByText('まだフォロワーがいません')).toBeInTheDocument()
  })
})
