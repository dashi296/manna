import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import type { PostWithUser } from '@/entities/post'
import { createQueryClient } from '@/shared/lib/queryClient'
import { scriptureVerseTextKeys } from '@/entities/scripture'
import { routeComponent } from '../../helpers/tanstack'
import { createSupabaseQueryChain } from '../../helpers/supabase'

const queryClient = createQueryClient()

// useSecondaryVerseTexts が useQuery を使うため QueryClientProvider が必要。
// 呼び出し側の render(<ChapterPage />) はそのままで自動的にラップされる。
const withQueryClient = (ui: React.ReactElement) => (
  <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
)

// 本番のローダーは ensureQueryData で第1言語の本文をキャッシュへ入れてから描画する。
// テストでもその状態を作ってから描く
function seedVerseTexts() {
  const ref = {
    collection: loaderData.collection,
    book: loaderData.book.id,
    chapter: loaderData.chapter,
  }
  const verses = loaderData.mode === 'verse' ? loaderData.verses : undefined
  queryClient.setQueryData(
    scriptureVerseTextKeys.chapter(ref, 'ja', verses),
    loaderData.verseTextsInCache,
  )
}

function render(ui: React.ReactElement) {
  seedVerseTexts()
  const utils = rtlRender(withQueryClient(ui))
  return {
    ...utils,
    rerender: (nextUi: React.ReactElement) => {
      // 遷移のたびにローダーが走るので、作り直しでも同じように温める
      seedVerseTexts()
      return utils.rerender(withQueryClient(nextUi))
    },
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

// 印は非対話の目印になったため、節シートを開く操作は節の行のタップに集約されている
function verseRow(container: HTMLElement, verse: number) {
  const row = container.querySelector<HTMLElement>(`li[data-verse="${verse}"]`)
  if (!row) throw new Error(`${verse}節の行が見つからない`)
  return row
}
function openVerseRowButton(container: HTMLElement, verse: number) {
  return within(verseRow(container, verse)).getByRole('button')
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
  // 本番のローダーは節本文を返さない。キャッシュへ入れる中身をテスト側で持つための項目
  verseTextsInCache: { verse: number; text_html: string }[]
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
  verseTextsInCache: [
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
// 章の見出し（テストごとに差し替える）
let clientChapterHeading: { title: string; summary: string | null; summary_html: string | null } | null = null

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
      if (table === 'scripture_chapter_headings') {
        return createSupabaseQueryChain(() => ({ data: clientChapterHeading ? [clientChapterHeading] : [] }))
      }
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
    clientChapterHeading = null
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
    const { container } = render(<ChapterPage />)

    await waitFor(() => {
      expect(within(verseRow(container, 3)).getByText('中')).toBeInTheDocument()
    })
    // 範囲の途中の節には印を置かない
    expect(within(verseRow(container, 4)).queryByText('中')).toBeNull()
    expect(within(verseRow(container, 5)).queryByText('中')).toBeNull()
  })

  it('印は行のボタンの内側にあり、印を押してもその節のシートが開く', async () => {
    // 印の列（コメントのアバター）がボタンの外にあると、そこだけタップしても
    // 何も起きないデッドゾーンになる
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
    const { container } = render(<ChapterPage />)

    const marker = await within(verseRow(container, 3)).findByText('中')
    const rowButton = openVerseRowButton(container, 3)
    expect(marker.closest('button')).toBe(rowButton)

    await user.click(marker)

    const call = navigateSpy.mock.calls.at(-1)![0]
    expect(call.search({})).toMatchObject({ comment: 3 })
  })

  it('継続節はアンカーではなく印が出ないが、covered の件数を読み上げに乗せる', async () => {
    // 視覚的なバッジ（anchored）は継続節に出ないが、その節のシートには投稿が出る。
    // sr-only の件数を anchored のままにすると継続節では 0 件のまま何も伝わらない
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [3, 4, 5])],
    }
    search = {}
    const { container } = render(<ChapterPage />)

    await waitFor(() => {
      expect(within(verseRow(container, 3)).getByText('中')).toBeInTheDocument()
    })
    expect(within(verseRow(container, 4)).queryByText('中')).toBeNull()
    expect(within(verseRow(container, 4)).getByText('コメント1件')).toBeInTheDocument()
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
    const { container } = render(<ChapterPage />)

    await waitFor(() => {
      expect(within(verseRow(container, 1)).getByText('中')).toBeInTheDocument()
    })
    expect(within(verseRow(container, 2)).getByText('田')).toBeInTheDocument()
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
    const { container } = render(<ChapterPage />)

    await waitFor(() => {
      expect(within(verseRow(container, 1)).getByText('中')).toBeInTheDocument()
    })
    expect(within(verseRow(container, 2)).queryByText('田')).toBeNull()
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

    expect(screen.queryByText('中')).toBeNull()
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
    const { container } = render(<ChapterPage />)

    await waitFor(() => {
      expect(within(verseRow(container, 3)).getByText('中')).toBeInTheDocument()
    })
    expect(within(verseRow(container, 6)).getByText('中')).toBeInTheDocument()
    // 7節は 6節から続く塊の途中なのでアンカーではない
    expect(within(verseRow(container, 7)).queryByText('中')).toBeNull()
    expect(within(verseRow(container, 4)).queryByText('中')).toBeNull()
  })

  it('節の行を押すと comment を push（replace: false）して戻るで閉じられるようにする', async () => {
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
    const { container } = render(<ChapterPage />)

    await user.click(openVerseRowButton(container, 3))

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

  it('シートが開いたまま別の節の行を押しても履歴を積まず、マーカーも足さない', async () => {
    // シートは非モーダルなので背後の節の行を押せる。押すたびに push すると閉じる操作が
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
    const { container } = render(<ChapterPage />)
    await screen.findByText('節3のコメント')

    await user.click(openVerseRowButton(container, 5))

    const call = navigateSpy.mock.calls.at(-1)![0]
    expect(call.search({})).toMatchObject({ comment: 5 })
    expect(call.replace).toBe(true)
    expect(call.state({})).not.toHaveProperty('mannaVerseSheet')
    // 既に付いているマーカーは落とさない（印から開いたエントリのまま差し替える）
    expect(call.state({ mannaVerseSheet: true })).toMatchObject({ mannaVerseSheet: true })
  })

  it('節の行を押すとシート由来のマーカーを履歴 state に載せる', async () => {
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
    const { container } = render(<ChapterPage />)

    await user.click(openVerseRowButton(container, 3))

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
    const { container } = render(<ChapterPage />)

    await waitFor(() => {
      expect(within(verseRow(container, 5)).getByText('田')).toBeInTheDocument()
    })
    expect(within(verseRow(container, 3)).queryByText('中')).toBeNull()
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
    expect(row.querySelector('.w-6')).toBeNull()
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
    expect(within(verseRow(container, 3)).queryByText('中')).toBeNull()
    const row = container.querySelector('li[data-verse="1"]')!
    expect(row.querySelector('.w-6')).not.toBeNull()
  })

  it('その節にコメントが無くても comment があればシートが開く。他の節の投稿は出ない', async () => {
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [3], '節3の投稿')],
    }
    // 2節にはコメントが無い
    search = { comment: 2 }
    render(<ChapterPage />)

    expect(await screen.findByText('第1ニーファイ書 1:2')).toBeInTheDocument()
    expect(screen.getByText('この節への投稿はまだありません')).toBeInTheDocument()
    expect(screen.queryByText('節3の投稿')).toBeNull()
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

  it('投稿シートを開いている間は節シートを描かない', async () => {
    // composeForVerse は節シートが実際に閉じる（search.comment のクリアが反映される）
    // まで投稿シートを開かずに待つ。ルーターをモックしているため、その反映をここで
    // 手動で再現してから投稿シートが開くことを確かめる
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [3, 4, 5], '節3のコメント')],
    }
    search = { comment: 3 }
    const user = userEvent.setup()
    const { rerender } = render(<ChapterPage />)

    await screen.findByText('節3のコメント')
    expect(document.body.querySelector('[data-slot="drawer-content"]')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'この節に投稿する' }))

    // ルーターが closeVerseSheet の navigate を実際に反映した状態を再現する
    search = { ...search, comment: undefined }
    rerender(<ChapterPage />)

    await waitFor(() => {
      expect(document.body.querySelector('[data-slot="sheet-content"]')).not.toBeNull()
    })
    expect(document.body.querySelector('[data-slot="drawer-content"]')).toBeNull()
  })

  it('節シートが開いたままの間は投稿シートを開かない', async () => {
    // 節シートを閉じる navigate は非同期に反映される。反映される前に投稿シートを
    // 開くと、閉じるための popstate を投稿シート側のリスナーが受けて即座に閉じてしまう
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [3], '節3のコメント')],
    }
    search = { comment: 3 }
    const user = userEvent.setup()
    render(<ChapterPage />)

    await screen.findByText('節3のコメント')

    await user.click(screen.getByRole('button', { name: 'この節に投稿する' }))

    // search.comment がまだクリアされていないので、節シートを保ったまま
    // 投稿シートは開かない
    expect(document.body.querySelector('[data-slot="sheet-content"]')).toBeNull()
    expect(document.body.querySelector('[data-slot="drawer-content"]')).not.toBeNull()
  })

  it('投稿シートが開けば search.comment が残っていても節シートを消す（!sheetOpen ガード）', async () => {
    // 章全体への投稿は composeForVerse を経由せず search.comment に触れない。
    // それでも投稿シートが開けば節シート側は !sheetOpen だけで隠れることを確かめる
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [3], '節3のコメント')],
    }
    search = { comment: 3 }
    const user = userEvent.setup()
    render(<ChapterPage />)

    await screen.findByText('節3のコメント')
    expect(document.body.querySelector('[data-slot="drawer-content"]')).not.toBeNull()

    await user.click(headerComposeTrigger())
    await user.click(await screen.findByRole('menuitem', { name: /章全体に投稿/ }))

    await waitFor(() => {
      expect(document.body.querySelector('[data-slot="sheet-content"]')).not.toBeNull()
    })
    expect(document.body.querySelector('[data-slot="drawer-content"]')).toBeNull()
  })

  it('「この節に投稿する」を連打しても history.back は1回しか走らない', async () => {
    // ガードが無いと、節シートが閉じ切る前の連打のたびに closeVerseSheet が
    // history.back() を呼び、章より前の履歴まで戻ってしまう
    canGoBack = true
    historyBackSpy.mockClear()
    window.history.pushState({ mannaVerseSheet: true }, '')
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [3], '節3のコメント')],
    }
    search = { comment: 3 }
    const user = userEvent.setup()
    render(<ChapterPage />)
    await screen.findByText('節3のコメント')

    const button = screen.getByRole('button', { name: 'この節に投稿する' })
    await user.click(button)
    await user.click(button)

    expect(historyBackSpy).toHaveBeenCalledTimes(1)
    window.history.replaceState({}, '')
  })

  it('保留中に章が変わったら、前の章の節番号で投稿シートを開かない', async () => {
    // 章移動のリンクなどで章が変わったのに保留を持ち越すと、次の章で
    // commentVerseForScroll が undefined になった瞬間に
    // 前の章の節番号で投稿シートが開いてしまう
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    const bookWithTwoChapters = { ...baseChapterData.book, verses: [20, 20] }
    loaderData = {
      ...baseChapterData,
      book: bookWithTwoChapters,
      chapter: 1,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [3], '節3のコメント')],
    }
    search = { comment: 3 }
    const user = userEvent.setup()
    const { rerender } = render(<ChapterPage />)
    await screen.findByText('節3のコメント')

    await user.click(screen.getByRole('button', { name: 'この節に投稿する' }))

    // 章移動のリンクなどで次の章へ移動。前章の comment=3 はこの章には無関係
    loaderData = {
      ...baseChapterData,
      book: bookWithTwoChapters,
      chapter: 2,
      circlePosts: [],
    }
    search = {}
    rerender(<ChapterPage />)

    await waitFor(() => {
      expect(screen.getByText('一節の本文')).toBeInTheDocument()
    })
    expect(document.body.querySelector('[data-slot="sheet-content"]')).toBeNull()
  })

  it('保留中に章全体への投稿を始めたら、後から保留が発火しても対象節をすり替えない', async () => {
    // 節3への投稿を保留した直後に、ユーザーが FAB/ヘッダーから章全体への投稿へ
    // 気を変える場合がある。ユーザーの最後の操作が勝つべきで、保留は捨てるのが正しい
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [circlePost('p1', 'u1', '中村さん', [3], '節3のコメント')],
    }
    search = { comment: 3 }
    const user = userEvent.setup()
    const { rerender } = render(<ChapterPage />)
    await screen.findByText('節3のコメント')

    // 節3への投稿を保留する（節シートを閉じている途中）
    await user.click(screen.getByRole('button', { name: 'この節に投稿する' }))

    // 保留がまだ発火していない間に、章全体への投稿を始める
    await user.click(headerComposeTrigger())
    await user.click(await screen.findByRole('menuitem', { name: /章全体に投稿/ }))

    // シートの見出しは initialScripture を毎レンダー直接参照するため、
    // PostEditor 内部の state 同期を経由せずすり替わりを検出できる
    expect(
      screen.getByRole('heading', { name: '📖 第1ニーファイ書 第1章' }),
    ).toBeInTheDocument()

    // ルーターが closeVerseSheet の navigate を実際に反映した状態を再現する。
    // 保留が生きたままだと、ここで見出しが節3向けにすり替わってしまう
    search = { ...search, comment: undefined }
    rerender(<ChapterPage />)

    await waitFor(() => {
      expect(document.body.querySelector('[data-slot="sheet-content"]')).not.toBeNull()
    })
    expect(
      screen.getByRole('heading', { name: '📖 第1ニーファイ書 第1章' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /1:3/ })).toBeNull()
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

  it('シートが開いている間は、コメントが指す節すべてが塗られたままになる', async () => {
    // 印は非対話の目印なので焦点もポインタも持たない。塗りの持ち主はシートだけ
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

  it('節の行を押して開いたときはスムーズにスクロールする', async () => {
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

  it('視差効果を減らす設定なら節の行を押してもスムーズにしない', async () => {
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

  it('コメントが無い節でも ?comment= でシートが開く', async () => {
    loaderData = { ...baseChapterData }
    search = { comment: 2 }

    render(<ChapterPage />)

    expect(await screen.findByText('第1ニーファイ書 1:2')).toBeInTheDocument()
    expect(screen.getByText('この節への投稿はまだありません')).toBeInTheDocument()
  })

  it('章の範囲外の ?comment= ではシートを開かない', async () => {
    loaderData = { ...baseChapterData }
    search = { comment: 9999 }

    render(<ChapterPage />)

    await screen.findByText('一節の本文')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('下限の comment=1 でもシートが開く', async () => {
    loaderData = { ...baseChapterData }
    search = { comment: 1 }

    render(<ChapterPage />)

    expect(await screen.findByText('第1ニーファイ書 1:1')).toBeInTheDocument()
    expect(screen.getByText('この節への投稿はまだありません')).toBeInTheDocument()
  })

  it('章の最終節（comment=maxVerse）でもシートが開く', async () => {
    // baseChapterData の book.verses は [20]（1章は20節まで）
    loaderData = { ...baseChapterData }
    search = { comment: 20 }

    render(<ChapterPage />)

    expect(await screen.findByText('第1ニーファイ書 1:20')).toBeInTheDocument()
    expect(screen.getByText('この節への投稿はまだありません')).toBeInTheDocument()
  })

  it('章の最終節の次（comment=maxVerse+1）ではシートを開かない', async () => {
    loaderData = { ...baseChapterData }
    search = { comment: 21 }

    render(<ChapterPage />)

    await screen.findByText('一節の本文')
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

  it('継続節を指定するとその節に関わるコメントが全件シートに出る', async () => {
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

  it('章のタイトルと概要を本文の前に出す', async () => {
    clientChapterHeading = { title: '第1章', summary: '要約', summary_html: '<b>要約</b>' }
    render(<ChapterPage />)
    expect(await screen.findByText('要約')).toBeInTheDocument()
    // 同じ文字列がヘッダーの見出しにもあるので、本文側は見出しにしない
    expect(screen.getAllByText('第1章')).toHaveLength(2)
    expect(screen.getAllByRole('heading', { name: '第1章' })).toHaveLength(1)

    // 節の前に出す。後ろに付くと本文を読み始めてから概要に出会う
    const title = screen.getByTestId('chapter-heading')
    const firstVerse = document.querySelector('li[data-verse="1"]')!
    expect(title.compareDocumentPosition(firstVerse) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('概要が無い章（旧約・新約）ではタイトルだけを出す', async () => {
    clientChapterHeading = { title: '第1章', summary: null, summary_html: null }
    render(<ChapterPage />)
    await waitFor(() => expect(screen.getAllByText('第1章')).toHaveLength(2))
    expect(screen.queryByText('要約')).not.toBeInTheDocument()
  })

  it('併記が有効なら概要も両言語を出す', async () => {
    const { useBilingualDisplayStore } = await import('@/entities/bilingual-display')
    useBilingualDisplayStore.setState({ enabled: true })
    clientChapterHeading = { title: '第1章', summary: '要約', summary_html: '要約' }
    render(<ChapterPage />)
    // 第1言語・第2言語で同じ応答を返すモックなので、同じ文字列が2つ出る
    await waitFor(() => expect(screen.getAllByText('要約')).toHaveLength(2))
  })

  it('併記表示が有効なとき、クライアント側で取得した第2言語の節本文を表示する', async () => {
    const { useBilingualDisplayStore } = await import('@/entities/bilingual-display')
    useBilingualDisplayStore.setState({ enabled: true })
    clientVerseTexts = [{ verse: 1, text_html: 'Verse one in English' }]
    loaderData = {
      ...baseChapterData,
      verseTextsInCache: [{ verse: 1, text_html: '一節の日本語' }],
    }
    render(<ChapterPage />)
    expect(screen.getByText('一節の日本語')).toBeInTheDocument()
    expect(await screen.findByText('Verse one in English')).toBeInTheDocument()
  })

  it('併記表示を ON→OFF→ON と切り替えても同じ章なら再取得しない（キャッシュされる）', async () => {
    clientVerseTexts = [{ verse: 1, text_html: 'Verse one in English' }]
    loaderData = {
      ...baseChapterData,
      verseTextsInCache: [{ verse: 1, text_html: '一節の日本語' }],
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
      verseTextsInCache: [{ verse: 1, text_html: '第1章の日本語' }],
    }
    const { rerender } = render(<ChapterPage />)
    expect(await screen.findByText('Chapter 1 English')).toBeInTheDocument()

    // SPA遷移（同一マウントのまま props/loaderData だけ更新される）を模す
    clientVerseTexts = [{ verse: 1, text_html: 'Chapter 2 English' }]
    loaderData = {
      ...baseChapterData,
      book: bookWithTwoChapters,
      chapter: 2,
      verseTextsInCache: [{ verse: 1, text_html: '第2章の日本語' }],
    }
    rerender(<ChapterPage />)

    expect(screen.getByText('第2章の日本語')).toBeInTheDocument()
    expect(screen.queryByText('Chapter 1 English')).toBeNull()

    expect(await screen.findByText('Chapter 2 English')).toBeInTheDocument()
  })

  it('併記表示が無効なとき、第2言語の節本文は表示しない', () => {
    loaderData = {
      ...baseChapterData,
      verseTextsInCache: [{ verse: 1, text_html: '一節の日本語' }],
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

  describe('前章・次章への導線', () => {
    it('章末尾に次章へのリンクを出す', () => {
      loaderData = { ...baseChapterData, chapter: 5 }
      search = {}
      render(<ChapterPage />)

      expect(screen.getByRole('link', { name: '次の章: 第6章' })).toHaveAttribute(
        'href',
        expect.stringContaining('/scriptures/bofm/1-ne/6'),
      )
    })

    it('章末尾に前章へのリンクを出す', () => {
      loaderData = { ...baseChapterData, chapter: 5 }
      search = {}
      render(<ChapterPage />)

      expect(screen.getByRole('link', { name: '前の章: 第4章' })).toHaveAttribute(
        'href',
        expect.stringContaining('/scriptures/bofm/1-ne/4'),
      )
    })

    // 同じ書の中では書名が自明なので章だけにする。またぐときは書名が要る
    it('書をまたぐ移動先には書名を付ける', () => {
      loaderData = { ...baseChapterData, chapter: 22 }
      search = {}
      render(<ChapterPage />)

      expect(screen.getByRole('link', { name: '次の章: 第2ニーファイ書 第1章' })).toHaveAttribute(
        'href',
        expect.stringContaining('/scriptures/bofm/2-ne/1'),
      )
      expect(screen.getByRole('link', { name: '前の章: 第21章' })).toBeInTheDocument()
    })

    // 前付け文書はスキップするため、1-ne 1章の手前には移動先が無い
    it('コレクション先頭では前章リンクを出さない', () => {
      loaderData = { ...baseChapterData, chapter: 1 }
      search = {}
      render(<ChapterPage />)

      const nav = screen.getByRole('navigation', { name: '章の移動' })
      expect(within(nav).getByRole('link', { name: '次の章: 第2章' })).toBeInTheDocument()
      expect(within(nav).getAllByRole('link')).toHaveLength(1)
    })

    // 前付け文書は移動先から外れるので、隣が前付けでも通常の書まで飛ばす
    it('前付け文書からは残りの前付けを飛ばして最初の書へ送る', () => {
      loaderData = {
        ...baseChapterData,
        book: { id: 'bofm-title', name: 'モルモン書のタイトルページ', chapters: 1, verses: [4], isFrontMatter: true },
        chapter: 1,
      }
      search = {}
      render(<ChapterPage />)

      const nav = screen.getByRole('navigation', { name: '章の移動' })
      expect(within(nav).getByRole('link', { name: '次の章: 第1ニーファイ書 第1章' })).toHaveAttribute(
        'href',
        expect.stringContaining('/scriptures/bofm/1-ne/1'),
      )
      expect(within(nav).getAllByRole('link')).toHaveLength(1)
    })

    it('節を選んでいる最中は出さない', () => {
      loaderData = { ...baseChapterData, chapter: 5 }
      search = { mode: 'select', select: [1] }
      render(<ChapterPage />)

      expect(screen.queryByTestId('chapter-nav')).toBeNull()
    })

    it('節表示では出さない', () => {
      loaderData = { ...baseChapterData, mode: 'verse', verses: [1] }
      search = {}
      render(<ChapterPage />)

      expect(screen.queryByTestId('chapter-nav')).toBeNull()
    })
  })
})
