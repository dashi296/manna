import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, dehydrate, hydrate } from '@tanstack/react-query'
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

// 章の見出しは節本文と別のテーブルから引く
let heading: { title: string; summary: string | null; summary_html: string | null } | null = {
  title: '第5章',
  summary: '概要',
  summary_html: '概要',
}
const headingFetches: string[] = []
vi.mock('@/shared/lib/supabase', async () => {
  const { createSupabaseQueryChain } = await import('../../helpers/supabase')
  return {
    supabase: {
      from: (table: string) => {
        headingFetches.push(table)
        return createSupabaseQueryChain(() => ({ data: heading ? [heading] : [] }))
      },
    },
  }
})

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
  headingFetches.length = 0
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

    // ローダーの時点で本文と見出しが1回ずつ取れている
    expect(fetched).toEqual([{ chapter: 5, language: 'ja' }])
    expect(headingFetches).toEqual(['scripture_chapter_headings'])
    const afterLoader = { verses: fetched.length, headings: headingFetches.length }

    expect(await screen.findByText('ja の本文')).toBeInTheDocument()

    // 描画側がローダーと同じキーを見ていなければ、ここで取り直しが増える
    expect(fetched.length).toBe(afterLoader.verses)
    expect(headingFetches.length).toBe(afterLoader.headings)
  })

  it('先読みフックが入れた本文を、遷移先のローダーがそのまま使う', async () => {
    const { useAdjacentChapterTexts } = await import('@/features/swipe-chapter-navigation')
    const mod = await import('@/pages/scriptures/$collection/$book/$chapter')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    // 4章を開いている状態から、実際の先読みフックを回す（3章と5章を取る）
    const { result } = renderHook(
      () =>
        useAdjacentChapterTexts({
          loc: { collection: 'bofm', book: '1-ne', chapter: 4 },
          enabled: true,
          bilingual: false,
        }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      },
    )
    await waitFor(() => expect(result.current.next?.primary.size).toBe(1))
    expect(fetched.map((f) => f.chapter).sort()).toEqual([3, 5])

    // 5章へ遷移したときのローダー
    await routeLoader(mod)({ params, deps: {}, context: { queryClient } })

    // 先読みと同じキーなので取り直さない
    expect(fetched.map((f) => f.chapter).sort()).toEqual([3, 5])
  })

  it('SSR で温めたキャッシュは、直列化して渡した先でも使える', async () => {
    const mod = await import('@/pages/scriptures/$collection/$book/$chapter')
    const serverClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    loaderData = await routeLoader(mod)({ params, deps: {}, context: { queryClient: serverClient } })
    expect(fetched).toHaveLength(1)

    // 本番の SSR はここを JSON で通してブラウザへ渡す
    const payload = JSON.parse(JSON.stringify(dehydrate(serverClient)))
    const browserClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    hydrate(browserClient, payload)

    const Route = mod.Route as unknown as {
      useSearch: () => Record<string, unknown>
      useNavigate: () => ReturnType<typeof vi.fn>
    }
    Route.useSearch = () => ({})
    Route.useNavigate = () => vi.fn()

    render(
      <QueryClientProvider client={browserClient}>
        {(() => {
          const ChapterPage = routeComponent(mod)
          return <ChapterPage />
        })()}
      </QueryClientProvider>,
    )

    expect(await screen.findByText('ja の本文')).toBeInTheDocument()
    // 直列化で落ちていれば、ここで取り直しが走る
    expect(fetched).toHaveLength(1)
  })
})
