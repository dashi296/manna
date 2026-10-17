import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routeComponent, routeLoader } from '../../helpers/tanstack'
import { renderWithQueryClient } from '../../helpers/query'
import { deferred } from '../../helpers/deferred'
import { createQueryClient } from '@/shared/lib/queryClient'
import { profileKey, userPostsKey } from '@/entities/user'
import { cursorAt, loadMoreButton, makePost, postsPage } from '../../helpers/fixtures'

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

type Call = { data: { cursor?: unknown } }

const renderPage = async (
  overrides: Partial<typeof profile> = {},
  pages: ReturnType<typeof postsPage>[] = [postsPage([])],
) => {
  let pageIndex = 0
  mockServerFn.mockImplementation((call: Call) =>
    Promise.resolve('cursor' in call.data ? pages[pageIndex++] : { ...profile, ...overrides }),
  )
  const ProfilePage = routeComponent(await import('@/pages/profile/$userId/index'))
  const utils = renderWithQueryClient(() => <ProfilePage />)
  // loader が先にキャッシュを埋めるのは本番だけなので、ここでは取得完了を待つ
  await screen.findByRole('heading', { level: 2, name: 'テスト太郎' })
  return utils
}

describe('ProfilePage', () => {
  beforeEach(() => {
    mockServerFn.mockReset()
  })

  it('表示名とフォロワー数/フォロー中数を表示する', async () => {
    await renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'テスト太郎' })).toBeInTheDocument()
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

  it('他人のプロフィールにはフォローとファミリーの操作を表示する', async () => {
    await renderPage({ currentUserId: 'me' })
    expect(screen.getByRole('button', { name: 'フォロー' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ファミリーに追加' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ログアウト' })).toBeNull()
  })

  it('投稿を別クエリで取得して表示する', async () => {
    const { client } = await renderPage({}, [
      postsPage([
        makePost({ id: 'p1', content: '最初の投稿' }),
        makePost({ id: 'p2', content: '次の投稿' }),
      ]),
    ])
    expect(await screen.findByText('最初の投稿')).toBeInTheDocument()
    expect(screen.getByText('次の投稿')).toBeInTheDocument()
    // プロフィール本体と投稿でキーが分かれている（フォロー操作で投稿を取り直さないため）
    expect(client.getQueryData(['profile', 'u2'])).toMatchObject({ followerCount: 3 })
    expect(client.getQueryData(['user-posts', 'u2'])).toBeTruthy()
  })

  it('投稿が0件のときは空状態を表示する', async () => {
    await renderPage()
    expect(await screen.findByText('投稿はまだありません')).toBeInTheDocument()
  })

  it('nextCursor がなければ「もっと見る」を表示しない', async () => {
    await renderPage({}, [postsPage([makePost({ id: 'p1', content: '最初の投稿' })])])
    expect(await screen.findByText('最初の投稿')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'もっと見る' })).not.toBeInTheDocument()
  })

  it('「もっと見る」でカーソルを渡して次のページを追記する', async () => {
    const cursor = cursorAt('p1')
    await renderPage({}, [
      postsPage([makePost({ id: 'p1', content: '最初の投稿' })], cursor),
      postsPage([makePost({ id: 'p2', content: '古い投稿' })]),
    ])
    expect(await screen.findByText('最初の投稿')).toBeInTheDocument()

    await userEvent.click(loadMoreButton())

    expect(await screen.findByText('古い投稿')).toBeInTheDocument()
    expect(screen.getByText('最初の投稿')).toBeInTheDocument()
    expect(mockServerFn).toHaveBeenCalledWith({ data: { userId: 'u2', cursor } })
  })
})

const load = async (queryClient: ReturnType<typeof createQueryClient>) =>
  routeLoader(await import('@/pages/profile/$userId/index'))({
    params: { userId: 'u2' },
    deps: {},
    context: { queryClient },
  })

const skipTime = (ms: number) => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.now() + ms)
}

// router は hover の先読みとクリックの両方で loader を呼ぶ（defaultPreloadStaleTime: 0）。
// 取り直すかどうかは loader が決める（#86）
describe('プロフィールの loader', () => {
  const initial = { profile, postsPage: postsPage([makePost({ id: 'p1' })]) }

  beforeEach(() => {
    mockServerFn.mockReset()
    mockServerFn.mockResolvedValue(initial)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('先読みの直後のクリックでは取り直さない', async () => {
    const client = createQueryClient()
    await load(client)
    await load(client)
    expect(mockServerFn).toHaveBeenCalledTimes(1)
    expect(client.getQueryData(profileKey('u2'))).toEqual(profile)
  })

  it('先読みの取得中にクリックしたら、その取得に相乗りする', async () => {
    const pending = deferred()
    mockServerFn.mockReturnValueOnce(pending.promise)
    const client = createQueryClient()
    const preload = load(client)
    const enter = load(client)
    pending.resolve(initial)
    await Promise.all([preload, enter])
    expect(mockServerFn).toHaveBeenCalledTimes(1)
  })

  it('時間が経った訪問では取り直す', async () => {
    const client = createQueryClient()
    await load(client)
    skipTime(11 * 1000)
    await load(client)
    expect(mockServerFn).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['プロフィール', profileKey('u2')],
    ['投稿', userPostsKey('u2')],
  ])('%sが無効化されていれば、直後でも取り直す', async (_, queryKey) => {
    const client = createQueryClient()
    await load(client)
    // フォロー操作などの invalidateRelationQueries に相当する。購読者がいないので再取得は走らない
    await client.invalidateQueries({ queryKey, refetchType: 'none' })
    await load(client)
    expect(mockServerFn).toHaveBeenCalledTimes(2)
  })

  it('直後でも、取得中のクエリがあればその完了を待たずに取り直す', async () => {
    const client = createQueryClient()
    await load(client)
    // 「もっと見る」や無効化後の再取得が飛んでいる最中の再訪（#83）
    const pending = deferred()
    void client.fetchQuery({
      queryKey: profileKey('u2'),
      queryFn: () => pending.promise,
      staleTime: 0,
    })
    const outcome = await Promise.race([
      load(client).then(() => 'resolved'),
      new Promise((r) => setTimeout(() => r('pending'), 100)),
    ])
    expect(outcome).toBe('resolved')
    expect(mockServerFn).toHaveBeenCalledTimes(2)
    expect(client.getQueryData(profileKey('u2'))).toEqual(profile)
    pending.resolve({ ...profile, followerCount: 99 })
  })

  it('片方のキャッシュしか無ければ取り直す', async () => {
    const client = createQueryClient()
    client.setQueryData(profileKey('u2'), profile)
    await load(client)
    expect(mockServerFn).toHaveBeenCalledTimes(1)
    expect(client.getQueryData(userPostsKey('u2'))).toEqual({
      pages: [initial.postsPage],
      pageParams: [null],
    })
  })

  it('存在しないユーザーは 404 にする', async () => {
    mockServerFn.mockResolvedValue(null)
    await expect(load(createQueryClient())).rejects.toThrow('not found')
  })
})
