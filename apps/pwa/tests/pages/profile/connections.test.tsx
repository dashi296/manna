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

const deferred = () => {
  let resolve: (value: unknown) => void = () => {}
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve: (value: unknown) => resolve(value) }
}

const cursorAt = (otherId: string) => ({ createdAt: '2026-07-25T10:00:00+00:00', otherId })

const loadMoreButton = () => screen.getByRole('button', { name: 'もっと見る' })

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

  it('同じタブのまま loader が再実行されたら追加読み込み分を捨てる', async () => {
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

    const { rerender, ConnectionsPage } = await renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'もっと見る' }))
    expect(await screen.findByText('佐藤太郎')).toBeInTheDocument()

    // タブは同じまま、フォロー関係が変わって loader が再実行される。
    // 新しい1ページ目に既に佐藤太郎が含まれるため、古い追加分を残すと重複する
    loaderData.mockReturnValue({
      ...base,
      rows: [row('u1', '山田花子'), row('u2', '佐藤太郎')],
      nextCursor: null,
    })
    rerender(<ConnectionsPage />)

    expect(screen.getAllByText('佐藤太郎')).toHaveLength(1)
    expect(screen.getAllByText('山田花子')).toHaveLength(1)
  })

  it('取得中に loader データが入れ替わったら「もっと見る」を再び押せる状態にする', async () => {
    loaderData.mockReturnValue({
      ...base,
      rows: [row('u1', '山田花子')],
      nextCursor: cursorAt('u1'),
    })
    const first = deferred()
    mockFetchConnections.mockReturnValue(first.promise)

    const { rerender, ConnectionsPage } = await renderPage()
    await userEvent.click(loadMoreButton())
    expect(loadMoreButton()).toBeDisabled()

    // 取得が終わらないうちに loader が新しいデータを返す
    loaderData.mockReturnValue({
      ...base,
      tab: 'following',
      rows: [row('u9', '新一郎')],
      nextCursor: cursorAt('u9'),
    })
    rerender(<ConnectionsPage />)

    // 新しい一覧のページングが、前の通信の完了待ちで固まってはいけない
    expect(loadMoreButton()).not.toBeDisabled()
  })

  it('古いリクエストの完了で新しいリクエストの読み込み中状態を解除しない', async () => {
    loaderData.mockReturnValue({
      ...base,
      rows: [row('u1', '山田花子')],
      nextCursor: cursorAt('u1'),
    })
    const first = deferred()
    const second = deferred()
    mockFetchConnections.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const { rerender, ConnectionsPage } = await renderPage()
    await userEvent.click(loadMoreButton())

    loaderData.mockReturnValue({
      ...base,
      tab: 'following',
      rows: [row('u9', '新一郎')],
      nextCursor: cursorAt('u9'),
    })
    rerender(<ConnectionsPage />)

    await userEvent.click(loadMoreButton())
    expect(loadMoreButton()).toBeDisabled()

    await act(async () => {
      first.resolve({ ...base, rows: [row('u2', '佐藤太郎')], nextCursor: null })
    })

    // 2件目の取得はまだ続いているので、押せる状態に戻してはいけない
    expect(loadMoreButton()).toBeDisabled()
    expect(screen.queryByText('佐藤太郎')).not.toBeInTheDocument()
  })
})
