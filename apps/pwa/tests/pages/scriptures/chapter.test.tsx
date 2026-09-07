import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import type { PostWithUser } from '@/entities/post'
import { createQueryClient } from '@/shared/lib/queryClient'
import { routeComponent } from '../../helpers/tanstack'
import { createSupabaseQueryChain } from '../../helpers/supabase'

const queryClient = createQueryClient()

// useSecondaryVerseTexts が useQuery を使うため QueryClientProvider が必要。
// 呼び出し側の render(<ChapterPage />) はそのままで自動的にラップされる。
const withQueryClient = (ui: React.ReactElement) => (
  <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
)

function render(ui: React.ReactElement) {
  const utils = rtlRender(withQueryClient(ui))
  return {
    ...utils,
    rerender: (nextUi: React.ReactElement) => utils.rerender(withQueryClient(nextUi)),
  }
}

// 投稿導線はヘッダー内のピルとヘッダー外の FAB を常に両方マウントし、
// どちらを見せるかは CSS のブレークポイントが決める。jsdom はメディアクエリを
// 評価しないため、両方が DOM に居る前提でどちらかを選び取る。
const composeTriggers = () => screen.getAllByRole('button', { name: /投稿/ })
const headerComposeTrigger = () => {
  const found = composeTriggers().find((b) => b.closest('header') !== null)
  if (!found) throw new Error('ヘッダー内の投稿トリガーが見つからない')
  return found
}
const fabComposeTrigger = () => {
  const found = composeTriggers().find((b) => b.className.includes('fixed'))
  if (!found) throw new Error('FAB の投稿トリガーが見つからない')
  return found
}

type TestLoaderData = {
  book: {
    id: string
    name: string
    chapters: number
    verses: number[]
    isFrontMatter?: boolean
  }
  chapter: number
  collection: string
  mode: 'chapter' | 'verse'
  verses: number[]
  posts: PostWithUser[]
  verseTexts: { verse: number; text_html: string }[]
  userId: string | null
  chapterCommenters: { userId: string; name: string; avatarUrl: string | null }[]
  circlePosts: PostWithUser[]
}

const baseChapterData: TestLoaderData = {
  book: {
    id: '1-ne',
    name: '第1ニーファイ書',
    chapters: 22,
    verses: [20],
  },
  chapter: 1,
  collection: 'bofm',
  mode: 'chapter' as const,
  verses: [],
  posts: [],
  verseTexts: [
    { verse: 1, text_html: '一節の本文' },
    { verse: 2, text_html: '二節の本文' },
  ],
  userId: 'user-1',
  chapterCommenters: [],
  circlePosts: [],
}

let loaderData: TestLoaderData
let search: { select?: number[]; mode?: 'select'; comment?: number } = { select: [1, 2] }
const navigateSpy = vi.fn()
const historyBackSpy = vi.fn()
let canGoBack = true

// 併記表示ONのときにクライアント側で取得する第2言語の節本文（テストごとに差し替える）
let clientVerseTexts: { verse: number; text_html: string }[] = []
// scripture_verses へのクライアント側クエリが実行された回数（キャッシュ検証用）
let clientVerseFetchCount = 0

vi.mock('@tanstack/react-router', async () => {
  const { routerMock } = await import('../../helpers/tanstack')
  return {
    ...routerMock(() => loaderData),
    useRouter: () => ({
      invalidate: vi.fn(),
      history: { canGoBack: () => canGoBack, back: historyBackSpy },
    }),
    useNavigate: () => navigateSpy,
  }
})

vi.mock('@tanstack/react-start', async () => (await import('../../helpers/tanstack')).startMock())

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'scripture_verses') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }
      clientVerseFetchCount += 1
      return createSupabaseQueryChain(() => ({ data: clientVerseTexts }))
    },
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  },
}))

let ChapterPage: React.ComponentType

beforeAll(async () => {
  const mod = await import('@/pages/scriptures/$collection/$book/$chapter')
  const Route = mod.Route as unknown as {
    useSearch: () => { select?: number[]; mode?: 'select' }
    useNavigate: () => ReturnType<typeof vi.fn>
  }
  Route.useSearch = () => search
  Route.useNavigate = () => navigateSpy
  ChapterPage = routeComponent(mod)
})

describe('ChapterPage', () => {
  beforeEach(async () => {
    loaderData = baseChapterData
    search = { select: [1, 2] }
    clientVerseTexts = []
    clientVerseFetchCount = 0
    navigateSpy.mockClear()
    localStorage.clear()
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    const { useBookmarkStore } = await import('@/entities/bookmark')
    useBookmarkStore.setState({ readingPosition: null, bookmarks: [] })
    const { useBilingualDisplayStore } = await import('@/entities/bilingual-display')
    useBilingualDisplayStore.setState({ enabled: false })
    queryClient.clear()
    // テストごとに innerWidth を書き換えるものがあるため既定へ戻す（useIsMobile が読む）
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
  })

  it('選択中でも「章に投稿」は節指定なしでシートを開く', async () => {
    const user = userEvent.setup()
    render(<ChapterPage />)

    await user.click(headerComposeTrigger())
    await user.click(await screen.findByRole('menuitem', { name: /章全体に投稿/ }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '📖 第1ニーファイ書 第1章' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('節 (例: 7, 9)')).toHaveValue('')
  })

  it('章表示から開いた投稿シートでは聖典・書・章を選び直せない', async () => {
    const user = userEvent.setup()
    render(<ChapterPage />)

    await user.click(headerComposeTrigger())
    await user.click(await screen.findByRole('menuitem', { name: /章全体に投稿/ }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
    expect(screen.getByPlaceholderText('節 (例: 7, 9)')).toBeInTheDocument()
  })

  it('節表示から開いた投稿シートでも聖典・書・章を選び直せない', async () => {
    loaderData = { ...baseChapterData, mode: 'verse', verses: [1] }
    const user = userEvent.setup()
    render(<ChapterPage />)

    await user.click(screen.getAllByRole('button', { name: '投稿する' })[0])

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
  })

  it('未ログインの章表示では投稿導線を表示しない', () => {
    loaderData = { ...baseChapterData, userId: null }

    render(<ChapterPage />)

    expect(screen.queryByRole('button', { name: /投稿/ })).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByTestId('selection-bar')).toBeNull()
    expect(screen.queryByRole('button', { name: 'キャンセル' })).toBeNull()
  })

  it('選択モードでキャンセルすると mode と select が URL から確実にクリアされる', async () => {
    search = { mode: 'select', select: [1, 2] }
    const user = userEvent.setup()
    render(<ChapterPage />)

    expect(screen.getByText('2節選択中')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /キャンセル/ }))

    expect(navigateSpy).toHaveBeenCalled()
    const lastCall = navigateSpy.mock.calls.at(-1)?.[0]
    const result = lastCall.search({ mode: 'select', select: [1, 2] })

    expect(result.mode).toBeUndefined()
    expect(result.select).toBeUndefined()
  })

  it('ComposeMenu から選択モードに入ると mode=select を push (replace: false) で反映する', async () => {
    search = {}
    const user = userEvent.setup()
    render(<ChapterPage />)

    await user.click(headerComposeTrigger())
    await user.click(await screen.findByRole('menuitem', { name: /節を選んで投稿/ }))

    expect(navigateSpy).toHaveBeenCalled()
    const lastCall = navigateSpy.mock.calls.at(-1)?.[0]
    const result = lastCall.search({})

    expect(result.mode).toBe('select')
    expect(lastCall.replace).toBe(false)
  })

  it('validateSearch はカンマ区切りの select/verses を配列に復元する', async () => {
    const mod = await import('@/pages/scriptures/$collection/$book/$chapter')
    const Route = mod.Route as unknown as {
      validateSearch: (s: Record<string, unknown>) => { verses?: number[]; select?: number[]; mode?: string }
    }
    const validate = Route.validateSearch

    expect(validate({ select: '1,3' })).toMatchObject({ select: [1, 3] })
    expect(validate({ select: ['1', '3'] })).toMatchObject({ select: [1, 3] })
    expect(validate({ select: [1, 3] })).toMatchObject({ select: [1, 3] })
    expect(validate({ verses: '2,5,7' })).toMatchObject({ verses: [2, 5, 7] })
    expect(validate({ mode: 'select', select: '1,3' })).toMatchObject({
      mode: 'select',
      select: [1, 3],
    })
    expect(validate({ select: 'abc,-1,0,4' })).toMatchObject({ select: [4] })
  })

  it('validateSearch は comment を10進の節番号としてのみ受け取る', async () => {
    const mod = await import('@/pages/scriptures/$collection/$book/$chapter')
    const Route = mod.Route as unknown as {
      validateSearch: (s: Record<string, unknown>) => { comment?: number }
    }
    const validate = Route.validateSearch

    expect(validate({ comment: '7' })).toMatchObject({ comment: 7 })
    expect(validate({ comment: 7 })).toMatchObject({ comment: 7 })

    // Number() に素通しすると 16進や boolean を節番号として受理してしまう
    expect(validate({ comment: '0x10' }).comment).toBeUndefined()
    expect(validate({ comment: true }).comment).toBeUndefined()
    expect(validate({ comment: '7.5' }).comment).toBeUndefined()
    expect(validate({ comment: ' 7 ' }).comment).toBeUndefined()
    expect(validate({ comment: '1e2' }).comment).toBeUndefined()
    expect(validate({ comment: ['7'] }).comment).toBeUndefined()
    expect(validate({ comment: '0' }).comment).toBeUndefined()
    expect(validate({ comment: '-3' }).comment).toBeUndefined()
    expect(validate({ comment: '' }).comment).toBeUndefined()
    expect(validate({}).comment).toBeUndefined()
  })

  it('未ログインの節表示では投稿導線を表示しない', () => {
    loaderData = {
      ...baseChapterData,
      mode: 'verse',
      verses: [1],
      userId: null,
    }

    render(<ChapterPage />)

    expect(screen.queryByRole('button', { name: '投稿する' })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('ログイン済みなら章コメンター行に自身の commenter がある時アバターを描画', () => {
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [
        { userId: 'u1', name: '中村さん', avatarUrl: null },
      ],
    }
    render(<ChapterPage />)
    expect(
      screen.getByRole('button', { name: '中村さん を選ぶ' }),
    ).toBeInTheDocument()
  })

  it('選択済みだと解除ボタンが出て、押すと store から解除される', async () => {
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: 'u1' })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [
        { userId: 'u1', name: '中村さん', avatarUrl: null },
      ],
    }
    const user = userEvent.setup()
    render(<ChapterPage />)
    await user.click(screen.getByRole('button', { name: '選択解除' }))
    expect(useSelectedUserStore.getState().selectedUserId).toBeNull()
  })

  it('未ログインならアバター行を出さない', () => {
    loaderData = {
      ...baseChapterData,
      userId: null,
      chapterCommenters: [
        { userId: 'u1', name: '中村さん', avatarUrl: null },
      ],
    }
    render(<ChapterPage />)
    expect(
      screen.queryByRole('button', { name: '中村さん を選ぶ' }),
    ).toBeNull()
  })

  const circlePost = (
    id: string,
    userId: string,
    name: string,
    verses: number[],
    content = `${id} の本文`,
  ): PostWithUser =>
    ({
      id,
      content,
      visibility: 'public' as const,
      created_at: '2026-07-19T00:00:00.000Z',
      updated_at: '2026-07-19T00:00:00.000Z',
      scripture_collection: 'bofm',
      scripture_book: '1-ne',
      scripture_chapter: 1,
      scripture_verses: verses,
      user_id: userId,
      users: { display_name: name, avatar_url: null },
    }) as PostWithUser

  it('複数節の投稿の印はアンカー節にだけ出る', async () => {
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [3, 4, 5])],
    }
    search = {}
    render(<ChapterPage />)

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /3節のコメントを見る/ }),
      ).toBeInTheDocument()
    })
    // 範囲の途中の節には印もボタンも置かない
    expect(screen.queryByRole('button', { name: /4節のコメントを見る/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /5節のコメントを見る/ })).toBeNull()
  })

  it('ユーザー未選択でも身内全員の印が出る', async () => {
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [
        { userId: 'u1', name: '中村さん', avatarUrl: null },
        { userId: 'u2', name: '田中さん', avatarUrl: null },
      ],
      circlePosts: [
        circlePost('p1', 'u1', '中村さん', [1]),
        circlePost('p2', 'u2', '田中さん', [2]),
      ],
    }
    search = {}
    render(<ChapterPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /1節のコメントを見る/ })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /2節のコメントを見る/ })).toBeInTheDocument()
  })

  it('ユーザーを選ぶとその人の印だけに絞られる', async () => {
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: 'u1' })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [
        { userId: 'u1', name: '中村さん', avatarUrl: null },
        { userId: 'u2', name: '田中さん', avatarUrl: null },
      ],
      circlePosts: [
        circlePost('p1', 'u1', '中村さん', [1]),
        circlePost('p2', 'u2', '田中さん', [2]),
      ],
    }
    search = {}
    render(<ChapterPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /1節のコメントを見る/ })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /2節のコメントを見る/ })).toBeNull()
  })

  it('mode=select 中は印を描画しない', async () => {
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [1])],
    }
    search = { mode: 'select', select: [1] }
    render(<ChapterPage />)

    expect(screen.queryByRole('button', { name: /節のコメントを見る/ })).toBeNull()
  })

  it('印にホバーするとその投稿の対象節だけがハイライトされる', async () => {
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [3, 4, 5])],
    }
    search = {}
    const user = userEvent.setup()
    const { container } = render(<ChapterPage />)

    const marker = await screen.findByRole('button', { name: /3節のコメントを見る/ })
    await user.hover(marker)

    await waitFor(() => {
      expect(container.querySelectorAll('[data-highlighted="true"]')).toHaveLength(3)
    })

    await user.unhover(marker)
    await waitFor(() => {
      expect(container.querySelectorAll('[data-highlighted="true"]')).toHaveLength(0)
    })
  })

  it('飛び番の投稿は連続する塊ごとに印が出る', async () => {
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [3, 6, 7])],
    }
    search = {}
    render(<ChapterPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /3節のコメントを見る/ })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /6節のコメントを見る/ })).toBeInTheDocument()
    // 7節は 6節から続く塊の途中なのでアンカーではない
    expect(screen.queryByRole('button', { name: /7節のコメントを見る/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /4節/ })).toBeNull()
  })

  it('印を押すと comment を push（replace: false）して戻るで閉じられるようにする', async () => {
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [3, 4, 5])],
    }
    search = {}
    navigateSpy.mockClear()
    const user = userEvent.setup()
    render(<ChapterPage />)

    await user.click(await screen.findByRole('button', { name: /3節のコメントを見る/ }))

    const call = navigateSpy.mock.calls.at(-1)![0]
    expect(call.replace).toBe(false)
    expect(call.search({})).toMatchObject({ comment: 3 })
  })

  it('URL を書き換える操作はスクロール位置をリセットしない', async () => {
    loaderData = { ...baseChapterData }
    search = { mode: 'select', select: [] }
    navigateSpy.mockClear()
    const user = userEvent.setup()
    render(<ChapterPage />)

    await user.click(screen.getByRole('checkbox', { name: '2節を選択' }))

    expect(navigateSpy.mock.calls.at(-1)![0]).toMatchObject({ resetScroll: false })
  })

  it('シートが開いたまま別の印を押しても履歴を積まず、マーカーも足さない', async () => {
    // シートは非モーダルなので背後の印を押せる。押すたびに push すると閉じる操作が
    // 前の節のシートに戻ってしまう。また直リンクで開いたエントリにマーカーを足すと、
    // 閉じたときに章から離脱する
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [
        circlePost('p1', 'u1', '中村さん', [3], '節3のコメント'),
        circlePost('p2', 'u1', '中村さん', [5], '節5のコメント'),
      ],
    }
    search = { comment: 3 }
    navigateSpy.mockClear()
    const user = userEvent.setup()
    render(<ChapterPage />)
    await screen.findByText('節3のコメント')

    await user.click(screen.getByRole('button', { name: /5節のコメントを見る/ }))

    const call = navigateSpy.mock.calls.at(-1)![0]
    expect(call.search({})).toMatchObject({ comment: 5 })
    expect(call.replace).toBe(true)
    expect(call.state({})).not.toHaveProperty('mannaVerseSheet')
    // 既に付いているマーカーは落とさない（印から開いたエントリのまま差し替える）
    expect(call.state({ mannaVerseSheet: true })).toMatchObject({ mannaVerseSheet: true })
  })

  it('印を押すとシート由来のマーカーを履歴 state に載せる', async () => {
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [3])],
    }
    search = {}
    navigateSpy.mockClear()
    const user = userEvent.setup()
    render(<ChapterPage />)

    await user.click(await screen.findByRole('button', { name: /3節のコメントを見る/ }))

    const call = navigateSpy.mock.calls.at(-1)![0]
    expect(call.replace).toBe(false)
    expect(call.state({})).toMatchObject({ mannaVerseSheet: true })
  })

  it('履歴 state にマーカーがあれば back で戻す', async () => {
    canGoBack = true
    historyBackSpy.mockClear()
    navigateSpy.mockClear()
    // 印から開いたエントリを再現する。進む操作やリロードでも state は復元されるため、
    // ref と違ってブラウザ履歴と同期する
    window.history.pushState({ mannaVerseSheet: true }, '')
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [3], '節3のコメント')],
    }
    search = { comment: 3 }
    render(<ChapterPage />)
    await screen.findByText('節3のコメント')

    await userEvent.keyboard('{Escape}')

    await waitFor(() => {
      expect(historyBackSpy).toHaveBeenCalled()
    })
    expect(navigateSpy).not.toHaveBeenCalled()
    window.history.replaceState({}, '')
  })

  it('戻れず直リンクでもないときも comment を消して閉じる', async () => {
    canGoBack = false
    historyBackSpy.mockClear()
    navigateSpy.mockClear()
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [3], '節3のコメント')],
    }
    search = { comment: 3 }
    render(<ChapterPage />)
    await screen.findByText('節3のコメント')

    await userEvent.keyboard('{Escape}')

    await waitFor(() => {
      expect(navigateSpy.mock.calls.at(-1)![0].search({})).toMatchObject({
        comment: undefined,
      })
    })
    expect(historyBackSpy).not.toHaveBeenCalled()
    canGoBack = true
  })

  it('直リンクのシートは受け手のユーザー絞り込みに関わらず開く', async () => {
    // 共有リンクを開いた側が別のユーザーで絞り込んでいても、送った側が見せたい
    // コメントは開かなければ意味がない。背後の印は絞り込んだままにする
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: 'u2' })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [
        { userId: 'u1', name: '中村さん', avatarUrl: null },
        { userId: 'u2', name: '田中さん', avatarUrl: null },
      ],
      circlePosts: [
        circlePost('p1', 'u1', '中村さん', [3], '中村さんの節3コメント'),
        circlePost('p2', 'u2', '田中さん', [5]),
      ],
    }
    search = { comment: 3 }
    render(<ChapterPage />)

    expect(await screen.findByText('中村さんの節3コメント')).toBeInTheDocument()
  })

  it('絞り込み中でも背後の印は絞り込んだままにする', async () => {
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: 'u2' })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [
        { userId: 'u1', name: '中村さん', avatarUrl: null },
        { userId: 'u2', name: '田中さん', avatarUrl: null },
      ],
      circlePosts: [
        circlePost('p1', 'u1', '中村さん', [3]),
        circlePost('p2', 'u2', '田中さん', [5]),
      ],
    }
    search = {}
    render(<ChapterPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /5節のコメントを見る/ })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /3節のコメントを見る/ })).toBeNull()
  })

  it('章の範囲内に印が1つも無いならガターの幅を確保しない', async () => {
    // scripture_verses に DB 側の範囲制約が無いため、範囲外の節だけを持つ投稿が
    // 存在しうる。その場合ガターは空のまま本文だけが狭くなる
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [999])],
    }
    search = {}
    const { container } = render(<ChapterPage />)

    await waitFor(() => {
      expect(screen.getByText('一節の本文')).toBeInTheDocument()
    })
    const row = container.querySelector('li[data-verse="1"]')!
    expect(row.querySelector('.w-7')).toBeNull()
  })

  it('絞り込みで印が消えてもガターの幅は保つ（レイアウトを揺らさない）', async () => {
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: 'u2' })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [
        { userId: 'u1', name: '中村さん', avatarUrl: null },
        { userId: 'u2', name: '田中さん', avatarUrl: null },
      ],
      // 絞り込み対象の u2 はこの章に投稿していない
      circlePosts: [circlePost('p1', 'u1', '中村さん', [3])],
    }
    search = {}
    const { container } = render(<ChapterPage />)

    await waitFor(() => {
      expect(screen.getByText('一節の本文')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /節のコメントを見る/ })).toBeNull()
    const row = container.querySelector('li[data-verse="1"]')!
    expect(row.querySelector('.w-7')).not.toBeNull()
  })

  it('その節にコメントが無いなら comment があってもシートを開かない', async () => {
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [3])],
    }
    // 2節にはコメントが無い
    search = { comment: 2 }
    render(<ChapterPage />)

    await waitFor(() => {
      expect(screen.getByText('一節の本文')).toBeInTheDocument()
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('search.comment があるとその節のシートを開く', async () => {
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [3, 4, 5], '節3のコメント')],
    }
    search = { comment: 3 }
    render(<ChapterPage />)

    expect(await screen.findByText('節3のコメント')).toBeInTheDocument()
  })

  it('シート内のコメントにホバーするとその投稿の対象節だけがハイライトされる', async () => {
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [
        circlePost('p1', 'u1', '中村さん', [3, 4, 5], 'またぐ投稿'),
        circlePost('p2', 'u1', '中村さん', [5], '節5だけの投稿'),
      ],
    }
    search = { comment: 5 }
    const { container } = render(<ChapterPage />)

    const card = await screen.findByText('またぐ投稿')
    fireEvent.pointerOver(card.closest('a')!.parentElement!)

    await waitFor(() => {
      expect(container.querySelectorAll('[data-highlighted="true"]')).toHaveLength(3)
    })
  })

  // jsdom の :focus-visible はテスト順で揺れるため、実ブラウザの
  // 「輪郭の出るフォーカス」を明示的に作る
  function makeFocusVisible(el: HTMLElement) {
    const matches = el.matches.bind(el)
    el.matches = ((sel: string) =>
      sel === ':focus-visible' ? true : matches(sel)) as typeof el.matches
  }

  // 印をまたぐ塗りの所有権。印1つ分の中だけで持つと、別の印から離脱しただけで
  // フォーカスが残っている印の塗りまで消える
  const twoMarks = () => ({
    ...baseChapterData,
    chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
    circlePosts: [
      circlePost('p1', 'u1', '中村さん', [3, 4, 5], 'A の投稿'),
      circlePost('p2', 'u1', '中村さん', [10, 11], 'B の投稿'),
    ],
  })

  it('A をキーボードで塗ったまま B にホバーして離れても、A の塗りが残る', async () => {
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = twoMarks()
    search = {}
    const { container } = render(<ChapterPage />)

    const a = await screen.findByRole('button', { name: /3節のコメントを見る/ })
    const b = screen.getByRole('button', { name: /10節のコメントを見る/ })
    makeFocusVisible(a)
    fireEvent.focus(a)
    await waitFor(() => {
      expect(container.querySelectorAll('[data-highlighted="true"]')).toHaveLength(3)
    })

    fireEvent.pointerEnter(b)
    await waitFor(() => {
      expect(container.querySelectorAll('[data-highlighted="true"]')).toHaveLength(2)
    })

    fireEvent.pointerLeave(b)
    await waitFor(() => {
      expect(container.querySelectorAll('[data-highlighted="true"]')).toHaveLength(3)
    })
  })

  it('A のフォーカスが外れたら、ホバー中の B の塗りに戻る', async () => {
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = twoMarks()
    search = {}
    const { container } = render(<ChapterPage />)

    const a = await screen.findByRole('button', { name: /3節のコメントを見る/ })
    const b = screen.getByRole('button', { name: /10節のコメントを見る/ })
    makeFocusVisible(a)
    fireEvent.focus(a)
    fireEvent.pointerEnter(b)
    fireEvent.blur(a)

    await waitFor(() => {
      expect(container.querySelectorAll('[data-highlighted="true"]')).toHaveLength(2)
    })
  })

  it('A をフォーカスしたまま B で pointercancel が起きても、A の塗りが残る', async () => {
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = twoMarks()
    search = {}
    const { container } = render(<ChapterPage />)

    const a = await screen.findByRole('button', { name: /3節のコメントを見る/ })
    const b = screen.getByRole('button', { name: /10節のコメントを見る/ })
    makeFocusVisible(a)
    fireEvent.focus(a)
    fireEvent.pointerCancel(b)

    await waitFor(() => {
      expect(container.querySelectorAll('[data-highlighted="true"]')).toHaveLength(3)
    })
  })

  it('シートが開いている間は、コメントが指す節すべてが塗られたままになる', async () => {
    // 印を押して開くとフォーカスが印からシートへ移り、印には blur が飛ぶ。
    // 塗りの持ち主を分けていないと、開いた直後に塗りが消える。
    // またホバーの無いタッチでは、開いた時点の塗りが範囲を知る唯一の手段になる
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [3, 4, 5], 'またぐ投稿')],
    }
    search = { comment: 3 }
    const { container } = render(<ChapterPage />)
    await screen.findByText('またぐ投稿')

    // 印からポインタが離れても、シートが開いている限り塗りは残る
    fireEvent.pointerOut(screen.getByRole('button', { name: /3節のコメントを見る/ }))

    await waitFor(() => {
      expect(container.querySelectorAll('[data-highlighted="true"]')).toHaveLength(3)
    })
  })

  it('シートに複数のコメントが出るときは、その全部が指す節を塗る', async () => {
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [
        circlePost('p1', 'u1', '中村さん', [3, 4, 5], 'またぐ投稿'),
        circlePost('p2', 'u1', '中村さん', [5, 6], '別のまたぐ投稿'),
      ],
    }
    search = { comment: 5 }
    const { container } = render(<ChapterPage />)
    await screen.findByText('またぐ投稿')

    // 3,4,5 と 5,6 の和集合で 3〜6 の4節
    await waitFor(() => {
      expect(container.querySelectorAll('[data-highlighted="true"]')).toHaveLength(4)
    })
  })

  it('シートを閉じた後は塗りが残らない', async () => {
    // 閉じるときフォーカスが印へ戻り、その focus で塗り直されていた
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [3, 4, 5], 'またぐ投稿')],
    }
    search = { comment: 3 }
    const { container, rerender } = render(<ChapterPage />)
    await screen.findByText('またぐ投稿')

    search = {}
    rerender(<ChapterPage />)
    // 閉じた後にブラウザがフォーカスを印へ戻す
    fireEvent.focus(screen.getByRole('button', { name: /3節のコメントを見る/ }))

    await waitFor(() => {
      expect(container.querySelectorAll('[data-highlighted="true"]')).toHaveLength(0)
    })
  })

  it('シートを開くとその節までスクロールする', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [15])],
    }
    search = { comment: 15 }
    const { container } = render(<ChapterPage />)

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled()
    })
    const target = container.querySelector('[data-verse="15"]')
    expect(scrollIntoView.mock.instances[0]).toBe(target)
    // smooth は移動中に content-visibility の節が実描画されても目標位置を更新せず、
    // 数百px ずれた場所で止まる
    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'auto' }),
    )
  })

  it('印を押して開いたときはスムーズにスクロールする', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [15])],
    }
    search = {}
    const { rerender } = render(<ChapterPage />)
    expect(scrollIntoView).not.toHaveBeenCalled()

    search = { comment: 15 }
    rerender(<ChapterPage />)

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: 'smooth' }),
      )
    })
  })

  it('視差効果を減らす設定なら印を押してもスムーズにしない', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    const originalMatchMedia = window.matchMedia
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      })) as unknown as typeof window.matchMedia

    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [15])],
    }
    search = {}
    const { rerender } = render(<ChapterPage />)
    search = { comment: 15 }
    rerender(<ChapterPage />)

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled()
    })
    expect(scrollIntoView).not.toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth' }),
    )
    window.matchMedia = originalMatchMedia
  })

  it('シートを開いていないときはスクロールしない', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    loaderData = { ...baseChapterData }
    search = {}
    render(<ChapterPage />)

    await waitFor(() => {
      expect(screen.getByText('一節の本文')).toBeInTheDocument()
    })
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('章に存在しない節の comment は無視する', async () => {
    loaderData = { ...baseChapterData }
    // baseChapterData の book.verses は [20]（1章は20節まで）
    search = { comment: 999 }
    render(<ChapterPage />)

    await waitFor(() => {
      expect(screen.getByText('一節の本文')).toBeInTheDocument()
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('章の節数を超える投稿があっても範囲外の comment は開かない', async () => {
    // scripture_verses に DB 側の範囲制約が無いため、API から直接作られた
    // 範囲外の投稿が存在しうる。commentIndex に載っていても開いてはいけない
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [999], '範囲外の投稿')],
    }
    search = { comment: 999 }
    render(<ChapterPage />)

    await waitFor(() => {
      expect(screen.getByText('一節の本文')).toBeInTheDocument()
    })
    expect(screen.queryByText('範囲外の投稿')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('0以下の comment は無視する', async () => {
    loaderData = { ...baseChapterData }
    search = { comment: 0 }
    render(<ChapterPage />)

    await waitFor(() => {
      expect(screen.getByText('一節の本文')).toBeInTheDocument()
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('mode=select 中は search.comment があってもシートを開かない', async () => {
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [3], '節3のコメント')],
    }
    search = { mode: 'select', comment: 3 }
    render(<ChapterPage />)

    expect(screen.queryByText('節3のコメント')).toBeNull()
  })

  it('継続節の印を押すとその節に関わるコメントが全件シートに出る', async () => {
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [
        { userId: 'u1', name: '中村さん', avatarUrl: null },
        { userId: 'u2', name: '田中さん', avatarUrl: null },
      ],
      circlePosts: [
        circlePost('p1', 'u1', '中村さん', [3, 4, 5], 'またぐ投稿'),
        circlePost('p2', 'u2', '田中さん', [4], '節4だけの投稿'),
      ],
    }
    search = { comment: 4 }
    render(<ChapterPage />)

    expect(await screen.findByText('またぐ投稿')).toBeInTheDocument()
    expect(screen.getByText('節4だけの投稿')).toBeInTheDocument()
  })

  it('章ページを開くと続きを読む位置が記録される', async () => {
    const { useBookmarkStore } = await import('@/entities/bookmark')
    render(<ChapterPage />)
    expect(useBookmarkStore.getState().readingPosition).toEqual({
      collection: 'bofm',
      book: '1-ne',
      chapter: 1,
    })
  })

  it('栞ボタンをクリックすると栞が追加される', async () => {
    const { useBookmarkStore } = await import('@/entities/bookmark')
    const user = userEvent.setup()
    render(<ChapterPage />)
    await user.click(screen.getByRole('button', { name: '栞に追加' }))
    expect(useBookmarkStore.getState().bookmarks).toHaveLength(1)
    expect(useBookmarkStore.getState().bookmarks[0]).toMatchObject({
      collection: 'bofm',
      book: '1-ne',
      chapter: 1,
    })
  })

  it('未ログインでも栞ボタンは表示される', () => {
    loaderData = { ...baseChapterData, userId: null }
    render(<ChapterPage />)
    expect(screen.getByRole('button', { name: '栞に追加' })).toBeInTheDocument()
  })

  it('節表示でも栞ボタンは表示される', () => {
    loaderData = { ...baseChapterData, mode: 'verse', verses: [1] }
    render(<ChapterPage />)
    expect(screen.getByRole('button', { name: '栞に追加' })).toBeInTheDocument()
  })

  it('章表示のタイトルは書名を含まず「第◯章」だけを表示する', () => {
    render(<ChapterPage />)
    expect(screen.getByRole('heading', { name: '第1章' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '第1ニーファイ書 第1章' })).toBeNull()
  })

  it('章表示の戻りリンクは書名を表示する', () => {
    render(<ChapterPage />)
    expect(screen.getByRole('link', { name: '第1ニーファイ書' })).toBeInTheDocument()
  })

  it('front matter の章表示ではタイトルに「第◯章」を付けず書名のみ表示する', () => {
    loaderData = {
      ...baseChapterData,
      book: { id: 'introduction', name: '序文', chapters: 1, verses: [9], isFrontMatter: true },
    }
    render(<ChapterPage />)
    expect(screen.getByRole('heading', { name: '序文' })).toBeInTheDocument()
  })

  it('front matter の節表示では戻りリンクに「第◯章」を付けず書名のみ表示する', () => {
    loaderData = {
      ...baseChapterData,
      mode: 'verse',
      verses: [1],
      book: { id: 'introduction', name: '序文', chapters: 1, verses: [9], isFrontMatter: true },
    }
    render(<ChapterPage />)
    expect(screen.getByRole('link', { name: '序文' })).toBeInTheDocument()
  })

  it('front matter の章表示では「戻る」ボタンが書一覧（コレクション名）へ遷移する', () => {
    loaderData = {
      ...baseChapterData,
      book: { id: 'introduction', name: '序文', chapters: 1, verses: [9], isFrontMatter: true },
    }
    render(<ChapterPage />)
    expect(screen.getByRole('link', { name: 'モルモン書' })).toBeInTheDocument()
  })

  it('front matter の章表示では段落番号を表示しない', () => {
    loaderData = {
      ...baseChapterData,
      book: { id: 'introduction', name: '序文', chapters: 1, verses: [9], isFrontMatter: true },
    }
    render(<ChapterPage />)
    expect(screen.queryByText('1')).toBeNull()
    expect(screen.queryByText('2')).toBeNull()
  })

  it('front matter の節表示では段落番号を表示しない', () => {
    loaderData = {
      ...baseChapterData,
      mode: 'verse',
      verses: [1],
      book: { id: 'introduction', name: '序文', chapters: 1, verses: [9], isFrontMatter: true },
    }
    render(<ChapterPage />)
    expect(screen.queryByText('1')).toBeNull()
  })

  it('日英併記ボタンをクリックするとストアの enabled が切り替わる（URLは変化しない）', async () => {
    const { useBilingualDisplayStore } = await import('@/entities/bilingual-display')
    const user = userEvent.setup()
    render(<ChapterPage />)
    await user.click(screen.getByRole('button', { name: '日英併記表示をオンにする' }))
    expect(useBilingualDisplayStore.getState().enabled).toBe(true)
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('併記表示が有効なとき、クライアント側で取得した第2言語の節本文を表示する', async () => {
    const { useBilingualDisplayStore } = await import('@/entities/bilingual-display')
    useBilingualDisplayStore.setState({ enabled: true })
    clientVerseTexts = [{ verse: 1, text_html: 'Verse one in English' }]
    loaderData = {
      ...baseChapterData,
      verseTexts: [{ verse: 1, text_html: '一節の日本語' }],
    }
    render(<ChapterPage />)
    expect(screen.getByText('一節の日本語')).toBeInTheDocument()
    expect(await screen.findByText('Verse one in English')).toBeInTheDocument()
  })

  it('併記表示を ON→OFF→ON と切り替えても同じ章なら再取得しない（キャッシュされる）', async () => {
    clientVerseTexts = [{ verse: 1, text_html: 'Verse one in English' }]
    loaderData = {
      ...baseChapterData,
      verseTexts: [{ verse: 1, text_html: '一節の日本語' }],
    }
    const user = userEvent.setup()
    render(<ChapterPage />)

    await user.click(screen.getByRole('button', { name: '日英併記表示をオンにする' }))
    await screen.findByText('Verse one in English')
    const fetchCountAfterFirstOn = clientVerseFetchCount
    expect(fetchCountAfterFirstOn).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: '日英併記表示をオフにする' }))
    expect(screen.queryByText('Verse one in English')).toBeNull()

    await user.click(screen.getByRole('button', { name: '日英併記表示をオンにする' }))
    await screen.findByText('Verse one in English')

    expect(clientVerseFetchCount).toBe(fetchCountAfterFirstOn)
  })

  it('併記表示が有効なまま別の章へ遷移すると、前の章の第2言語テキストが一瞬でも表示されない', async () => {
    const { useBilingualDisplayStore } = await import('@/entities/bilingual-display')
    useBilingualDisplayStore.setState({ enabled: true })
    const bookWithTwoChapters = { ...baseChapterData.book, verses: [20, 20] }
    clientVerseTexts = [{ verse: 1, text_html: 'Chapter 1 English' }]
    loaderData = {
      ...baseChapterData,
      book: bookWithTwoChapters,
      chapter: 1,
      verseTexts: [{ verse: 1, text_html: '第1章の日本語' }],
    }
    const { rerender } = render(<ChapterPage />)
    expect(await screen.findByText('Chapter 1 English')).toBeInTheDocument()

    // SPA遷移（同一マウントのまま props/loaderData だけ更新される）を模す
    clientVerseTexts = [{ verse: 1, text_html: 'Chapter 2 English' }]
    loaderData = {
      ...baseChapterData,
      book: bookWithTwoChapters,
      chapter: 2,
      verseTexts: [{ verse: 1, text_html: '第2章の日本語' }],
    }
    rerender(<ChapterPage />)

    expect(screen.getByText('第2章の日本語')).toBeInTheDocument()
    expect(screen.queryByText('Chapter 1 English')).toBeNull()

    expect(await screen.findByText('Chapter 2 English')).toBeInTheDocument()
  })

  it('併記表示が無効なとき、第2言語の節本文は表示しない', () => {
    loaderData = {
      ...baseChapterData,
      verseTexts: [{ verse: 1, text_html: '一節の日本語' }],
    }
    render(<ChapterPage />)
    expect(screen.getByText('一節の日本語')).toBeInTheDocument()
    expect(screen.queryByText('Verse one in English')).toBeNull()
  })

  it('章表示の投稿導線は初回描画からヘッダー外の FAB を持ち、lg 未満でのみ見せる', () => {
    render(<ChapterPage />)

    const fab = fabComposeTrigger()
    expect(fab.closest('header')).toBeNull()
    expect(fab.className).toContain('lg:hidden')
  })

  it('章表示のヘッダー内ピルは lg 以上でのみ見せる', () => {
    render(<ChapterPage />)

    const pill = headerComposeTrigger()
    expect(pill.className).not.toContain('fixed')
    expect(pill.className).toContain('hidden')
    expect(pill.className).toContain('lg:inline-flex')
  })

  it('章表示の FAB を押すと投稿の2択メニューが開く', async () => {
    const user = userEvent.setup()
    render(<ChapterPage />)

    await user.click(fabComposeTrigger())

    expect(await screen.findByRole('button', { name: /章全体に投稿/ })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /節を選んで投稿/ })).toBeInTheDocument()
  })

  it('節選択モード中は FAB を表示しない', async () => {
    search = { mode: 'select', select: [1] }
    render(<ChapterPage />)

    expect(await screen.findByText('1節選択中')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '投稿する' })).toBeNull()
  })

  it('節表示のタイトルに絵文字を含めない', () => {
    loaderData = { ...baseChapterData, mode: 'verse', verses: [1] }
    render(<ChapterPage />)
    expect(screen.getByRole('heading', { name: '第1ニーファイ書 1:1' })).toBeInTheDocument()
  })

  it('節表示の投稿リストは FAB に隠れないだけの下余白を持つ', () => {
    loaderData = {
      ...baseChapterData,
      mode: 'verse',
      verses: [1],
      posts: [
        {
          id: 'p1',
          content: '最後の投稿',
          visibility: 'public' as const,
          created_at: '2026-08-07T00:00:00.000Z',
          updated_at: '2026-08-07T00:00:00.000Z',
          scripture_collection: 'bofm',
          scripture_book: '1-ne',
          scripture_chapter: 1,
          scripture_verses: [1],
          user_id: 'u1',
          users: { display_name: '中村さん', avatar_url: null },
        },
      ],
    }
    render(<ChapterPage />)

    const list = screen.getByText('最後の投稿').closest('div.pb-\\[var\\(--fab-clearance\\)\\]')
    expect(list).not.toBeNull()
  })

  it('節表示の投稿導線は初回描画からヘッダー外の FAB を持ち、lg 未満でのみ見せる', () => {
    loaderData = { ...baseChapterData, mode: 'verse', verses: [1] }
    render(<ChapterPage />)

    const fab = fabComposeTrigger()
    expect(fab.closest('header')).toBeNull()
    expect(fab.className).toContain('lg:hidden')
  })

  it('節表示のヘッダー内ピルは lg 以上でのみ見せる', () => {
    loaderData = { ...baseChapterData, mode: 'verse', verses: [1] }
    render(<ChapterPage />)

    const pill = headerComposeTrigger()
    expect(pill.className).not.toContain('fixed')
    expect(pill.className).toContain('hidden')
    expect(pill.className).toContain('lg:inline-flex')
  })

  it('節表示の投稿導線は2択メニューを挟まず composer を直接開く', async () => {
    loaderData = { ...baseChapterData, mode: 'verse', verses: [1] }
    const user = userEvent.setup()
    render(<ChapterPage />)

    await user.click(fabComposeTrigger())

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByRole('menuitem')).toBeNull()
  })

  it('節表示のヘッダー内ピルからも同じ composer を開ける', async () => {
    loaderData = { ...baseChapterData, mode: 'verse', verses: [1] }
    const user = userEvent.setup()
    render(<ChapterPage />)

    await user.click(headerComposeTrigger())

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})
