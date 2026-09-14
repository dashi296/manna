import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAdjacentChapterTexts } from '@/features/swipe-chapter-navigation'
import { chapterHeadingQuery, scriptureVerseTextsQuery } from '@/entities/scripture'

// 節本文の取得そのものを差し替える。verseTextsQuery はこのモジュールから
// 直接 import しているので、バレル（@/entities/scripture）越しでは差し替わらない
const calls: { chapter: number; language: string }[] = []
let failing = false

const headingDelayMs: Record<string, number> = {}
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
        // どの言語の見出しを引いているかを eq('language', …) から拾い、
        // 言語ごとに遅らせ方を変える
        let language = ''
        const chain = createSupabaseQueryChain(
          () => ({ data: [{ title: '見出し', summary: null, summary_html: null }] }),
          (column, value) => {
            if (column === 'language') language = String(value)
          },
        )
        const settle = chain.maybeSingle
        chain.maybeSingle = () => {
          const delay = headingDelayMs[language] ?? 0
          return new Promise((resolve) => setTimeout(() => resolve(settle()), delay))
        }
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
const nextRef = { collection: 'bofm', book: '1-ne', chapter: 6 }

beforeEach(() => {
  calls.length = 0
  failing = false
  headingDelayMs.ja = 0
  headingDelayMs.en = 0
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
    headingDelayMs.ja = 200
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

  it('併記のときは第2言語の見出しもそろうまでプレビューを成立させない', async () => {
    // 第1言語の見出しは即返り、第2言語だけ遅れる
    headingDelayMs.en = 200
    const { result } = renderHook(
      () => useAdjacentChapterTexts({ loc, enabled: true, bilingual: true }),
      { wrapper },
    )

    // 第1言語ぶん（本文・見出し）がそろったことをキャッシュで確かめる。
    // これを待たずに null を見ても、第1言語の待ちで止まっているだけかもしれない
    await waitFor(() => {
      expect(client.getQueryData(scriptureVerseTextsQuery(nextRef, 'ja').queryKey)).toBeDefined()
      expect(client.getQueryData(chapterHeadingQuery(nextRef, 'ja').queryKey)).toBeDefined()
    })
    expect(result.current.next).toBeNull()

    await waitFor(() => expect(result.current.next?.secondaryHeading?.title).toBe('見出し'))
  })

  it('併記が有効なときだけ第2言語も取る', async () => {
    const { result } = renderHook(
      () => useAdjacentChapterTexts({ loc, enabled: true, bilingual: true }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.next?.secondary.get(1)).toBe('en-6'))
    expect(calls.filter((c) => c.language === 'en').map((c) => c.chapter).sort()).toEqual([4, 6])
  })

  it('併記をオフに戻したら、プレビューからも第2言語が消える', async () => {
    // 無効にしたクエリもキャッシュには残る。取り込み済みの英語を出し続けると、
    // 本体は日本語だけなのにプレビューだけ英語が並ぶ
    const { result, rerender } = renderHook(
      ({ bilingual }) => useAdjacentChapterTexts({ loc, enabled: true, bilingual }),
      { wrapper, initialProps: { bilingual: true } },
    )
    await waitFor(() => expect(result.current.next?.secondary.size).toBe(1))
    expect(result.current.next?.secondaryHeading).not.toBeNull()

    rerender({ bilingual: false })
    expect(result.current.next?.secondary.size).toBe(0)
    expect(result.current.next?.secondaryHeading).toBeNull()
    expect(result.current.next?.primary.get(1)).toBe('ja-6')
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
