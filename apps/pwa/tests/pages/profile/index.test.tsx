import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routeComponent } from '../../helpers/tanstack'
import { renderWithQueryClient } from '../../helpers/query'

// startMock はモジュール内の createServerFn を区別できないため、fetchProfileData と
// fetchUserPosts を引数で振り分ける（投稿側だけが cursor を持つ）
const mockServerFn = vi.fn()

vi.mock('@tanstack/react-router', async () =>
  (await import('../../helpers/tanstack')).routerMock(undefined, undefined, undefined, {
    useParams: () => ({ userId: 'u2' }),
  }),
)

vi.mock('@tanstack/react-start', async () =>
  (await import('../../helpers/tanstack')).startMock(mockServerFn),
)

vi.mock('@/shared/lib/supabase', () => ({
  supabase: { from: () => ({ insert: vi.fn(), update: vi.fn(), delete: vi.fn() }) },
}))

const profile = {
  profile: { id: 'u2', display_name: 'テスト太郎', avatar_url: null, bio: null },
  currentUserId: null as string | null,
  isFollowing: false,
  familyStatus: 'none',
  followerCount: 3,
  followingCount: 5,
}

const post = (id: string, content: string) => ({
  id,
  content,
  visibility: 'public',
  created_at: '2026-07-25T10:00:00+00:00',
  scripture_collection: null,
  scripture_book: null,
  scripture_chapter: null,
  scripture_verses: null,
  user_id: 'u2',
  users: { display_name: 'テスト太郎', avatar_url: null },
})

const postsPage = (posts: ReturnType<typeof post>[], nextCursor: unknown = null) => ({
  posts,
  nextCursor,
})

const cursorAt = (id: string) => ({ createdAt: '2026-07-25T10:00:00+00:00', id })

type Call = { data: { cursor?: unknown } }

const setup = (
  overrides: Partial<typeof profile> = {},
  pages: ReturnType<typeof postsPage>[] = [postsPage([])],
) => {
  let pageIndex = 0
  mockServerFn.mockImplementation((call: Call) => {
    if (!('cursor' in call.data)) return Promise.resolve({ ...profile, ...overrides })
    const next = pages[Math.min(pageIndex, pages.length - 1)]
    pageIndex += 1
    return Promise.resolve(next)
  })
}

const renderPage = async () => {
  const ProfilePage = routeComponent(await import('@/pages/profile/$userId/index'))
  const utils = renderWithQueryClient(() => <ProfilePage />)
  // loader が先にキャッシュを埋めるのは本番だけなので、ここでは取得完了を待つ
  await screen.findByRole('heading', { level: 2, name: 'テスト太郎' })
  return utils
}

const loadMoreButton = () => screen.getByRole('button', { name: 'もっと見る' })

describe('ProfilePage', () => {
  beforeEach(() => {
    mockServerFn.mockReset()
  })

  it('表示名とフォロワー数/フォロー中数を表示する', async () => {
    setup()
    await renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'テスト太郎' })).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('フォロワー数から一覧ページへのリンクを張る', async () => {
    setup()
    await renderPage()
    expect(screen.getByRole('link', { name: /フォロワー/ })).toHaveAttribute(
      'href',
      '/profile/u2/connections?tab=followers',
    )
  })

  it('フォロー中数から一覧ページへのリンクを張る', async () => {
    setup()
    await renderPage()
    expect(screen.getByRole('link', { name: /フォロー中/ })).toHaveAttribute(
      'href',
      '/profile/u2/connections?tab=following',
    )
  })

  it('自分のプロフィールではログアウトボタンを表示する', async () => {
    setup({ currentUserId: 'u2' })
    await renderPage()
    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument()
  })

  it('他人のプロフィールにはフォローとファミリーの操作を表示する', async () => {
    setup({ currentUserId: 'me' })
    await renderPage()
    expect(screen.getByRole('button', { name: 'フォロー' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ファミリーに追加' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ログアウト' })).toBeNull()
  })

  it('投稿を別クエリで取得して表示する', async () => {
    setup({}, [postsPage([post('p1', '最初の投稿'), post('p2', '次の投稿')])])
    const { client } = await renderPage()
    expect(await screen.findByText('最初の投稿')).toBeInTheDocument()
    expect(screen.getByText('次の投稿')).toBeInTheDocument()
    // プロフィール本体と投稿でキーが分かれている（フォロー操作で投稿を取り直さないため）
    expect(client.getQueryData(['profile', 'u2'])).toMatchObject({ followerCount: 3 })
    expect(client.getQueryData(['user-posts', 'u2'])).toBeTruthy()
  })

  it('投稿が0件のときは空状態を表示する', async () => {
    setup()
    await renderPage()
    expect(await screen.findByText('投稿はまだありません')).toBeInTheDocument()
  })

  it('nextCursor がなければ「もっと見る」を表示しない', async () => {
    setup({}, [postsPage([post('p1', '最初の投稿')])])
    await renderPage()
    expect(await screen.findByText('最初の投稿')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'もっと見る' })).not.toBeInTheDocument()
  })

  it('「もっと見る」でカーソルを渡して次のページを追記する', async () => {
    const cursor = cursorAt('p1')
    setup({}, [
      postsPage([post('p1', '最初の投稿')], cursor),
      postsPage([post('p2', '古い投稿')]),
    ])
    await renderPage()
    expect(await screen.findByText('最初の投稿')).toBeInTheDocument()

    await userEvent.click(loadMoreButton())

    expect(await screen.findByText('古い投稿')).toBeInTheDocument()
    expect(screen.getByText('最初の投稿')).toBeInTheDocument()
    expect(mockServerFn).toHaveBeenCalledWith({ data: { userId: 'u2', cursor } })
  })
})
