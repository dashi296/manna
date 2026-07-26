import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routeComponent, routeLoader } from '../../helpers/tanstack'
import { renderWithQueryClient } from '../../helpers/query'
import { deferred } from '../../helpers/deferred'

const mockFetchConnections = vi.fn()

// ページは loader ではなく params/search から queryKey を組み立てるため、
// タブの切り替えは useSearch の戻り値を差し替えて再レンダーすることで再現する
let currentTab: 'followers' | 'following' = 'followers'

vi.mock('@tanstack/react-router', async () =>
  (await import('../../helpers/tanstack')).routerMock(undefined, undefined, undefined, {
    useParams: () => ({ userId: 'owner' }),
    useSearch: () => ({ tab: currentTab }),
  }),
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

const page = (rows: ReturnType<typeof row>[], nextCursor: unknown = null) => ({
  userId: 'owner',
  tab: currentTab,
  currentUserId: 'me',
  rows,
  nextCursor,
})

const cursorAt = (otherId: string) => ({ createdAt: '2026-07-25T10:00:00+00:00', otherId })

const renderPage = async () => {
  const ConnectionsPage = routeComponent(await import('@/pages/profile/$userId/connections'))
  // useSearch の戻り値を差し替えてタブ切り替えを再現するため、rerender を持ち回る
  return renderWithQueryClient(() => <ConnectionsPage />)
}

const loadMoreButton = () => screen.getByRole('button', { name: 'もっと見る' })

describe('ConnectionsPage', () => {
  beforeEach(() => {
    currentTab = 'followers'
    mockFetchConnections.mockReset()
  })

  it('フォロワータブでユーザー一覧を表示する', async () => {
    mockFetchConnections.mockResolvedValue(page([row('u1', '山田花子'), row('u2', '佐藤太郎')]))
    await renderPage()
    expect(await screen.findByText('山田花子')).toBeInTheDocument()
    expect(screen.getByText('佐藤太郎')).toBeInTheDocument()
  })

  it('フォロー中タブのデータではフォロー中の一覧を表示する', async () => {
    currentTab = 'following'
    mockFetchConnections.mockResolvedValue(page([row('u3', '鈴木次郎')]))
    await renderPage()
    expect(await screen.findByText('鈴木次郎')).toBeInTheDocument()
  })

  it('自分自身の行にはフォローボタンを表示しない', async () => {
    mockFetchConnections.mockResolvedValue(page([row('me', '自分'), row('u1', '山田花子')]))
    await renderPage()
    expect(await screen.findByText('自分')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'フォロー' })).toHaveLength(1)
  })

  it('0件のときは空状態を表示する', async () => {
    mockFetchConnections.mockResolvedValue(page([]))
    await renderPage()
    expect(await screen.findByText('まだフォロワーがいません')).toBeInTheDocument()
  })

  it('nextCursor がなければ「もっと見る」を表示しない', async () => {
    mockFetchConnections.mockResolvedValue(page([row('u1', '山田花子')]))
    await renderPage()
    expect(await screen.findByText('山田花子')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'もっと見る' })).not.toBeInTheDocument()
  })

  it('「もっと見る」で次のページを末尾に追記する', async () => {
    mockFetchConnections
      .mockResolvedValueOnce(page([row('u1', '山田花子')], cursorAt('u1')))
      .mockResolvedValueOnce(page([row('u2', '佐藤太郎')]))
    await renderPage()
    expect(await screen.findByText('山田花子')).toBeInTheDocument()

    await userEvent.click(loadMoreButton())

    expect(await screen.findByText('佐藤太郎')).toBeInTheDocument()
    expect(screen.getByText('山田花子')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'もっと見る' })).not.toBeInTheDocument()
  })

  it('カーソルを渡して次のページを取得する', async () => {
    const cursor = cursorAt('u1')
    mockFetchConnections
      .mockResolvedValueOnce(page([row('u1', '山田花子')], cursor))
      .mockResolvedValueOnce(page([row('u2', '佐藤太郎')]))
    await renderPage()
    expect(await screen.findByText('山田花子')).toBeInTheDocument()

    await userEvent.click(loadMoreButton())
    await screen.findByText('佐藤太郎')

    expect(mockFetchConnections).toHaveBeenNthCalledWith(1, {
      data: { userId: 'owner', tab: 'followers', cursor: null },
    })
    expect(mockFetchConnections).toHaveBeenNthCalledWith(2, {
      data: { userId: 'owner', tab: 'followers', cursor },
    })
  })

  it('「もっと見る」が失敗しても行を追記せずボタンを再度押せる状態に戻す', async () => {
    mockFetchConnections
      .mockResolvedValueOnce(page([row('u1', '山田花子')], cursorAt('u1')))
      .mockRejectedValueOnce(new Error('boom'))
    await renderPage()
    expect(await screen.findByText('山田花子')).toBeInTheDocument()

    await userEvent.click(loadMoreButton())

    expect(loadMoreButton()).not.toBeDisabled()
    expect(screen.getAllByText('山田花子')).toHaveLength(1)
  })

  // loader は「再訪のたびに1ページ目を取り直す」ためにあるので、進行中の追加取得に
  // 相乗りして取り直しを飛ばしてしまわないことを固定する
  it('「もっと見る」の取得中に再訪しても、その完了を待たずに1ページ目を取り直す', async () => {
    const pending = deferred()
    mockFetchConnections
      .mockResolvedValueOnce(page([row('u1', '山田花子')], cursorAt('u1')))
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(page([row('u9', '新しい人')]))
    const { client } = await renderPage()
    expect(await screen.findByText('山田花子')).toBeInTheDocument()
    await userEvent.click(loadMoreButton())

    const loader = routeLoader(await import('@/pages/profile/$userId/connections'))
    const outcome = await Promise.race([
      loader({
        params: { userId: 'owner' },
        deps: { tab: 'followers' },
        context: { queryClient: client },
      }).then(() => 'resolved'),
      new Promise((r) => setTimeout(() => r('pending'), 100)),
    ])

    expect(outcome).toBe('resolved')
    expect(mockFetchConnections).toHaveBeenCalledTimes(3)
    expect(mockFetchConnections).toHaveBeenLastCalledWith({
      data: { userId: 'owner', tab: 'followers', cursor: null },
    })

    pending.resolve(page([row('u2', '佐藤太郎')]))
  })

  it('取得中にタブを切り替えたら、遅れて届いた前タブの結果を混ぜない', async () => {
    const pending = deferred()
    mockFetchConnections
      .mockResolvedValueOnce(page([row('u1', '山田花子')], cursorAt('u1')))
      .mockReturnValueOnce(pending.promise)
    const { rerenderWithQueryClient } = await renderPage()
    expect(await screen.findByText('山田花子')).toBeInTheDocument()
    await userEvent.click(loadMoreButton())

    // 取得の解決前にタブが切り替わる
    currentTab = 'following'
    mockFetchConnections.mockResolvedValue(page([row('u3', '鈴木次郎')]))
    rerenderWithQueryClient()
    expect(await screen.findByText('鈴木次郎')).toBeInTheDocument()

    // 前タブのリクエストが後から解決しても、その行は混入しない。
    // 解決後の再レンダーまで act で流し切ってから確認する（否定アサーションは
    // microtask 実行前だと素通りしてしまうため）
    await act(async () => {
      pending.resolve(page([row('u2', '佐藤太郎')]))
    })

    expect(screen.queryByText('佐藤太郎')).not.toBeInTheDocument()
    expect(screen.queryByText('山田花子')).not.toBeInTheDocument()
    expect(screen.getByText('鈴木次郎')).toBeInTheDocument()
  })
})
