import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAdjacentChapterTexts } from '@/features/swipe-chapter-navigation'

// 節本文の取得そのものを差し替える。verseTextsQuery はこのモジュールから
// 直接 import しているので、バレル（@/entities/scripture）越しでは差し替わらない
const calls: { chapter: number; language: string }[] = []
let failing = false

let headingDelayMs = 0
vi.mock('@/entities/scripture/lib/verseTexts', () => ({
  queryScriptureVerseTexts: async (
    _client: unknown,
    ref: { chapter: number },
    language: string,
  ) => {
    calls.push({ chapter: ref.chapter, language })
    if (failing) throw new Error('offline')
    return [{ verse: 1, text_html: `${language}-${ref.chapter}` }]
  },
}))

// 見出しは別テーブルなので、節本文のモックとは別に応答を用意する
vi.mock('@/shared/lib/supabase', async () => {
  const { createSupabaseQueryChain } = await import('../../helpers/supabase')
  return {
    supabase: {
      from: () => {
        const chain = createSupabaseQueryChain(() => ({
          data: [{ title: '見出し', summary: null, summary_html: null }],
        }))
        const slow = chain.maybeSingle
        chain.maybeSingle = () =>
          new Promise((resolve) => setTimeout(() => resolve(slow()), headingDelayMs))
        return chain
      },
    },
  }
})

// クライアントはテストごとに1つ。描画のたびに作り直すと、再描画で
// 取得中のクエリごと捨てられて結果が届かない
let client: QueryClient

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const loc = { collection: 'bofm', book: '1-ne', chapter: 5 }

beforeEach(() => {
  calls.length = 0
  failing = false
  headingDelayMs = 0
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

describe('useAdjacentChapterTexts', () => {
  it('有効なとき、前後の章の節本文を先読みする', async () => {
    const { result } = renderHook(
      () => useAdjacentChapterTexts({ loc, enabled: true, bilingual: false }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.next?.primary.get(1)).toBe('ja-6'))
    expect(result.current.prev?.primary.get(1)).toBe('ja-4')
    // 本文の前に入るものなので、先読みの対象に含める
    await waitFor(() => expect(result.current.next?.heading?.title).toBe('見出し'))
    expect(result.current.next?.ref).toEqual({ collection: 'bofm', book: '1-ne', chapter: 6 })
  })

  it('見出しの取得が終わるまでプレビューを成立させない', async () => {
    // 本文だけ先に返った時点で見出しなしのプレビューを出すと、
    // 遷移後に見出しが入って本文がその高さぶん飛ぶ
    headingDelayMs = 200
    const { result } = renderHook(
      () => useAdjacentChapterTexts({ loc, enabled: true, bilingual: false }),
      { wrapper },
    )
    await waitFor(() => expect(calls.some((c) => c.chapter === 6)).toBe(true))
    expect(result.current.next).toBeNull()

    await waitFor(() => expect(result.current.next?.heading?.title).toBe('見出し'))
    expect(result.current.next?.primary.get(1)).toBe('ja-6')
  })

  it('無効なときは1件も取りに行かない', async () => {
    renderHook(() => useAdjacentChapterTexts({ loc, enabled: false, bilingual: false }), { wrapper })
    await new Promise((r) => setTimeout(r, 30))
    expect(calls).toHaveLength(0)
  })

  it('移動先がない方向は取りに行かない', async () => {
    const { result } = renderHook(
      () =>
        useAdjacentChapterTexts({
          loc: { collection: 'bofm', book: '1-ne', chapter: 1 },
          enabled: true,
          bilingual: false,
        }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.next?.primary.size).toBe(1))
    expect(result.current.prev).toBeNull()
    expect(calls).toHaveLength(1)
  })

  it('併記が有効なときだけ第2言語も取る', async () => {
    const { result } = renderHook(
      () => useAdjacentChapterTexts({ loc, enabled: true, bilingual: true }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.next?.secondary.get(1)).toBe('en-6'))
    expect(calls.filter((c) => c.language === 'en').map((c) => c.chapter).sort()).toEqual([4, 6])
  })

  it('併記が無効なら第2言語は取らない', async () => {
    const { result } = renderHook(
      () => useAdjacentChapterTexts({ loc, enabled: true, bilingual: false }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.next?.primary.size).toBe(1))
    expect(calls.every((c) => c.language === 'ja')).toBe(true)
  })

  it('取得に失敗しても落ちず、その方向は空のままになる', async () => {
    failing = true
    const { result } = renderHook(
      () => useAdjacentChapterTexts({ loc, enabled: true, bilingual: false }),
      { wrapper },
    )
    await new Promise((r) => setTimeout(r, 80))
    expect(result.current.next).toBeNull()
    expect(result.current.prev).toBeNull()
  })
})
