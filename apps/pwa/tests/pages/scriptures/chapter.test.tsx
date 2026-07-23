import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PostWithUser } from '@/entities/post'
import { routeComponent } from '../../helpers/tanstack'

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
let search: { select?: number[]; mode?: 'select' } = { select: [1, 2] }
const navigateSpy = vi.fn()

vi.mock('@tanstack/react-router', async () => {
  const { routerMock } = await import('../../helpers/tanstack')
  return {
    ...routerMock(() => loaderData),
    useRouter: () => ({ invalidate: vi.fn() }),
    useNavigate: () => navigateSpy,
  }
})

vi.mock('@tanstack/react-start', async () => (await import('../../helpers/tanstack')).startMock())

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: () => ({ insert: vi.fn().mockResolvedValue({ error: null }) }),
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
    navigateSpy.mockClear()
    localStorage.clear()
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    const { useBookmarkStore } = await import('@/entities/bookmark')
    useBookmarkStore.setState({ readingPosition: null, bookmarks: [] })
  })

  it('選択中でも「章に投稿」は節指定なしでシートを開く', async () => {
    const user = userEvent.setup()
    render(<ChapterPage />)

    await user.click(screen.getByRole('button', { name: /投稿/ }))
    await user.click(await screen.findByRole('menuitem', { name: /章全体に投稿/ }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '📖 第1ニーファイ書 第1章' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('節 (例: 7, 9)')).toHaveValue('')
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

    await user.click(screen.getByRole('button', { name: /投稿/ }))
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

  it('mode=select 中は選択ユーザーがあっても吹き出しを描画しない', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1440 })
    window.dispatchEvent(new Event('resize'))
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: 'u1' })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [
        {
          id: 'p1',
          content: 'コメ',
          visibility: 'public' as const,
          created_at: '2026-07-19T00:00:00.000Z',
          scripture_collection: 'bofm',
          scripture_book: '1-ne',
          scripture_chapter: 1,
          scripture_verses: [1],
          user_id: 'u1',
          users: { display_name: '中村さん', avatar_url: null },
        },
      ],
    }
    search = { mode: 'select', select: [1] }
    render(<ChapterPage />)
    expect(screen.queryByRole('group', { name: /中村さんの吹き出し/ })).toBeNull()
  })

  it('desktop 相当なら選択ユーザーの吹き出しが節横に描画される', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1440 })
    window.dispatchEvent(new Event('resize'))
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: 'u1' })
    loaderData = {
      ...baseChapterData,
      chapterCommenters: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      circlePosts: [
        {
          id: 'p1',
          content: '節1 吹き出しテスト',
          visibility: 'public' as const,
          created_at: '2026-07-19T00:00:00.000Z',
          scripture_collection: 'bofm',
          scripture_book: '1-ne',
          scripture_chapter: 1,
          scripture_verses: [1],
          user_id: 'u1',
          users: { display_name: '中村さん', avatar_url: null },
        },
      ],
    }
    search = {}
    render(<ChapterPage />)
    await waitFor(() => {
      expect(screen.getByText('節1 吹き出しテスト')).toBeInTheDocument()
      expect(
        screen.getByRole('group', { name: /中村さんの吹き出し/ }),
      ).toBeInTheDocument()
    })
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
})
