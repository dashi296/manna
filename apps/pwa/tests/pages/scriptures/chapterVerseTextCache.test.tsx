import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routeComponent, routeLoader } from '../../helpers/tanstack'

// ローダー・ページ本体・隣章の先読みが同じキーを見ているかを、実際にローダーを
// 走らせて確かめる。3者のどこかでキーがずれると、ページが取り直して fetchCount が増える
const fetched: { chapter: number; language: string }[] = []
vi.mock('@/entities/scripture/lib/verseTexts', () => ({
  queryScriptureVerseTexts: async (
    _client: unknown,
    ref: { chapter: number },
    language: string,
  ) => {
    fetched.push({ chapter: ref.chapter, language })
    return [{ verse: 1, text_html: `${language} の本文` }]
  },
}))

vi.mock('@/shared/lib/supabase', () => ({ supabase: {} }))

let loaderData: unknown
vi.mock('@tanstack/react-router', async () => {
  const { routerMock } = await import('../../helpers/tanstack')
  return {
    ...routerMock(() => loaderData),
    useRouter: () => ({ invalidate: vi.fn(), history: { canGoBack: () => true, back: vi.fn() } }),
    useNavigate: () => vi.fn(),
  }
})

vi.mock('@tanstack/react-start', async () => {
  const { startMock } = await import('../../helpers/tanstack')
  return startMock(() => ({
    posts: [],
    userId: null,
    chapterCommenters: [],
    circlePosts: [],
  }))
})

const params = { collection: 'bofm', book: '1-ne', chapter: '5' }

beforeEach(() => {
  fetched.length = 0
})

describe('章の節本文のキャッシュ', () => {
  it('ローダーが温めたキャッシュからページ本体が描き、取り直さない', async () => {
    const mod = await import('@/pages/scriptures/$collection/$book/$chapter')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    loaderData = await routeLoader(mod)({
      params,
      deps: {},
      context: { queryClient },
    })

    // ローダーが取るのは第1言語の1回だけ
    expect(fetched).toEqual([{ chapter: 5, language: 'ja' }])
    // 本文はローダーの戻り値ではなくキャッシュに載る
    expect(loaderData).not.toHaveProperty('verseTexts')

    // routerMock の createFileRoute は useSearch / useNavigate を生やさないので補う
    const Route = mod.Route as unknown as {
      useSearch: () => Record<string, unknown>
      useNavigate: () => ReturnType<typeof vi.fn>
    }
    Route.useSearch = () => ({})
    Route.useNavigate = () => vi.fn()

    const ChapterPage = routeComponent(mod)
    render(
      <QueryClientProvider client={queryClient}>
        <ChapterPage />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('ja の本文')).toBeInTheDocument()
    // ページ本体がローダーと同じキーを見ていなければ、ここで2回目が走る
    expect(fetched).toEqual([{ chapter: 5, language: 'ja' }])
  })

  it('先読みが入れた本文を、遷移先のローダーがそのまま使う', async () => {
    const { scriptureVerseTextsQuery } = await import('@/entities/scripture')
    const mod = await import('@/pages/scriptures/$collection/$book/$chapter')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    // 隣章の先読みと同じ経路でキャッシュへ入れる
    await queryClient.ensureQueryData(
      scriptureVerseTextsQuery({ collection: 'bofm', book: '1-ne', chapter: 5 }, 'ja'),
    )
    expect(fetched).toHaveLength(1)

    await routeLoader(mod)({ params, deps: {}, context: { queryClient } })

    // ローダーは取り直さない
    expect(fetched).toHaveLength(1)
  })
})
