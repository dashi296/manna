import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routeComponent } from '../helpers/tanstack'
import { renderWithQueryClient } from '../helpers/query'
import { deferred } from '../helpers/deferred'
import { cursorAt, loadMoreButton, makePost } from '../helpers/fixtures'

const mockFetchFeed = vi.fn()
const navigate = vi.fn()

// ページは loader ではなく search から queryKey を組み立てるため、タブの切り替えは
// useSearch の戻り値を差し替えて再レンダーすることで再現する
let currentTab: 'following' | 'public' = 'following'

vi.mock('@tanstack/react-router', async () =>
  (await import('../helpers/tanstack')).routerMock(undefined, undefined, navigate, {
    useSearch: () => ({ tab: currentTab }),
  }),
)

vi.mock('@tanstack/react-start', async () =>
  (await import('../helpers/tanstack')).startMock(mockFetchFeed),
)

const page = (posts: ReturnType<typeof makePost>[], nextCursor: unknown = null) => ({
  posts,
  nextCursor,
})

const renderPage = async () => {
  const FeedPage = routeComponent(await import('@/pages/index'))
  return renderWithQueryClient(() => <FeedPage />)
}

describe('FeedPage', () => {
  beforeEach(() => {
    currentTab = 'following'
    mockFetchFeed.mockReset()
    navigate.mockReset()
  })

  it('タブ「全体」と「フォロー中」が表示される', async () => {
    mockFetchFeed.mockResolvedValue(page([]))
    await renderPage()
    expect(screen.getByText('フォロー中')).toBeInTheDocument()
    expect(screen.getByText('全体')).toBeInTheDocument()
  })

  it('見ているタブの投稿を表示する', async () => {
    mockFetchFeed.mockResolvedValue(page([makePost('p1', '最初の投稿'), makePost('p2', '次の投稿')]))
    await renderPage()
    expect(await screen.findByText('最初の投稿')).toBeInTheDocument()
    expect(screen.getByText('次の投稿')).toBeInTheDocument()
  })

  it('タブを queryFn に渡す', async () => {
    currentTab = 'public'
    mockFetchFeed.mockResolvedValue(page([]))
    await renderPage()
    await vi.waitFor(() =>
      expect(mockFetchFeed).toHaveBeenCalledWith({ data: { tab: 'public', cursor: null } }),
    )
  })

  it('0件のときはタブに応じた空状態を表示する', async () => {
    mockFetchFeed.mockResolvedValue(page([]))
    await renderPage()
    expect(
      await screen.findByText('フォロー中のユーザーの投稿はまだありません'),
    ).toBeInTheDocument()
  })

  it('nextCursor がなければ「もっと見る」を表示しない', async () => {
    mockFetchFeed.mockResolvedValue(page([makePost('p1', '最初の投稿')]))
    await renderPage()
    expect(await screen.findByText('最初の投稿')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'もっと見る' })).not.toBeInTheDocument()
  })

  it('「もっと見る」で次のページを末尾に追記する', async () => {
    mockFetchFeed
      .mockResolvedValueOnce(page([makePost('p1', '最初の投稿')], cursorAt('p1')))
      .mockResolvedValueOnce(page([makePost('p2', '古い投稿')]))
    await renderPage()
    expect(await screen.findByText('最初の投稿')).toBeInTheDocument()

    await userEvent.click(loadMoreButton())

    expect(await screen.findByText('古い投稿')).toBeInTheDocument()
    expect(screen.getByText('最初の投稿')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'もっと見る' })).not.toBeInTheDocument()
  })

  it('カーソルを渡して次のページを取得する', async () => {
    const cursor = cursorAt('p1')
    mockFetchFeed
      .mockResolvedValueOnce(page([makePost('p1', '最初の投稿')], cursor))
      .mockResolvedValueOnce(page([makePost('p2', '古い投稿')]))
    await renderPage()
    expect(await screen.findByText('最初の投稿')).toBeInTheDocument()

    await userEvent.click(loadMoreButton())
    await screen.findByText('古い投稿')

    expect(mockFetchFeed).toHaveBeenNthCalledWith(2, {
      data: { tab: 'following', cursor },
    })
  })

  it('タブを押すと search を切り替える', async () => {
    mockFetchFeed.mockResolvedValue(page([]))
    await renderPage()
    await userEvent.click(screen.getByText('全体'))
    expect(navigate).toHaveBeenCalledWith({ to: '/', search: { tab: 'public' } })
  })

  it('既定タブに戻すときは search を空にする（/ に ?tab= を残さない）', async () => {
    currentTab = 'public'
    mockFetchFeed.mockResolvedValue(page([]))
    await renderPage()
    await userEvent.click(screen.getByText('フォロー中'))
    expect(navigate).toHaveBeenCalledWith({ to: '/', search: {} })
  })

  it('取得中にタブを切り替えたら、遅れて届いた前タブの結果を混ぜない', async () => {
    const pending = deferred()
    mockFetchFeed
      .mockResolvedValueOnce(page([makePost('p1', 'フォロー中の投稿')], cursorAt('p1')))
      .mockReturnValueOnce(pending.promise)
    const { rerenderWithQueryClient } = await renderPage()
    expect(await screen.findByText('フォロー中の投稿')).toBeInTheDocument()
    await userEvent.click(loadMoreButton())

    currentTab = 'public'
    mockFetchFeed.mockResolvedValue(page([makePost('p9', '全体の投稿')]))
    rerenderWithQueryClient()
    expect(await screen.findByText('全体の投稿')).toBeInTheDocument()

    await act(async () => {
      pending.resolve(page([makePost('p2', '遅れて届いた投稿')]))
    })

    expect(screen.queryByText('遅れて届いた投稿')).not.toBeInTheDocument()
    expect(screen.queryByText('フォロー中の投稿')).not.toBeInTheDocument()
  })
})
