import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PostWithUser } from '@/entities/post'
import { routeComponent } from '../../helpers/tanstack'

type TestLoaderData = {
  book: {
    id: string
    name: string
    chapters: number
    verses: number[]
  }
  chapter: number
  collection: string
  mode: 'chapter' | 'verse'
  verses: number[]
  posts: PostWithUser[]
  countByVerse: Record<number, number>
  verseTexts: { verse: number; text_html: string }[]
  userId: string | null
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
  countByVerse: {},
  verseTexts: [
    { verse: 1, text_html: '一節の本文' },
    { verse: 2, text_html: '二節の本文' },
  ],
  userId: 'user-1',
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
  beforeEach(() => {
    loaderData = baseChapterData
    search = { select: [1, 2] }
    navigateSpy.mockClear()
    localStorage.clear()
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
})
