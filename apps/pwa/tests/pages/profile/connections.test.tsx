import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routeComponent } from '../../helpers/tanstack'

const loaderData = vi.fn()
const mockFetchConnections = vi.fn()

vi.mock('@tanstack/react-router', async () =>
  (await import('../../helpers/tanstack')).routerMock(() => loaderData()),
)

vi.mock('@tanstack/react-start', async () =>
  (await import('../../helpers/tanstack')).startMock(mockFetchConnections),
)

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
  return { ...render(<ConnectionsPage />), ConnectionsPage }
}

describe('ConnectionsPage', () => {
  beforeEach(() => {
    mockFetchConnections.mockReset()
  })

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

  it('nextCursor があるときだけ「もっと見る」を表示する', async () => {
    loaderData.mockReturnValue({ ...base, rows: [row('u1', '山田花子')], nextCursor: null })
    await renderPage()
    expect(screen.queryByRole('button', { name: 'もっと見る' })).not.toBeInTheDocument()
  })

  it('「もっと見る」で次のページを末尾に追記する', async () => {
    loaderData.mockReturnValue({
      ...base,
      rows: [row('u1', '山田花子')],
      nextCursor: { createdAt: '2026-07-25T10:00:00+00:00', otherId: 'u1' },
    })
    mockFetchConnections.mockResolvedValue({
      ...base,
      rows: [row('u2', '佐藤太郎')],
      nextCursor: null,
    })
    await renderPage()

    await userEvent.click(screen.getByRole('button', { name: 'もっと見る' }))

    expect(await screen.findByText('佐藤太郎')).toBeInTheDocument()
    expect(screen.getByText('山田花子')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'もっと見る' })).not.toBeInTheDocument()
  })

  it('「もっと見る」が失敗しても行を追記せずボタンを再度押せる状態に戻す', async () => {
    loaderData.mockReturnValue({
      ...base,
      rows: [row('u1', '山田花子')],
      nextCursor: { createdAt: '2026-07-25T10:00:00+00:00', otherId: 'u1' },
    })
    mockFetchConnections.mockRejectedValue(new Error('boom'))
    await renderPage()

    const loadMoreButton = screen.getByRole('button', { name: 'もっと見る' })
    await userEvent.click(loadMoreButton)

    expect(await screen.findByRole('button', { name: 'もっと見る' })).not.toBeDisabled()
    expect(screen.getByText('山田花子')).toBeInTheDocument()
    expect(screen.getAllByText('山田花子')).toHaveLength(1)
  })

  it('取得中にタブを切り替えたら、遅れて届いた前タブの結果を捨てる', async () => {
    loaderData.mockReturnValue({
      ...base,
      rows: [row('u1', '山田花子')],
      nextCursor: { createdAt: '2026-07-25T10:00:00+00:00', otherId: 'u1' },
    })

    let resolveFetch: (value: unknown) => void = () => {}
    mockFetchConnections.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve
      }),
    )

    const { rerender, ConnectionsPage } = await renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'もっと見る' }))

    // 取得の解決前にタブが切り替わる
    loaderData.mockReturnValue({
      ...base,
      tab: 'following',
      rows: [row('u3', '鈴木次郎')],
      nextCursor: null,
    })
    rerender(<ConnectionsPage />)
    expect(screen.getByText('鈴木次郎')).toBeInTheDocument()

    // 前タブのリクエストが後から解決しても、その行は混入しない。
    // 解決後の setState まで act で流し切ってから確認する（否定アサーションは
    // microtask 実行前だと素通りしてしまうため）
    await act(async () => {
      resolveFetch({ ...base, rows: [row('u2', '佐藤太郎')], nextCursor: null })
    })

    expect(screen.queryByText('佐藤太郎')).not.toBeInTheDocument()
    expect(screen.getByText('鈴木次郎')).toBeInTheDocument()
    expect(screen.queryByText('山田花子')).not.toBeInTheDocument()
  })
})
