import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAdjacentChapterTexts } from '@/features/swipe-chapter-navigation'

const preloadRoute = vi.fn()
const router = { preloadRoute }
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => router,
}))

const queryVerseTexts = vi.fn()
vi.mock('@/entities/scripture', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/scripture')>()),
  queryScriptureVerseTexts: (...args: unknown[]) => queryVerseTexts(...args),
}))

vi.mock('@/shared/lib/supabase', () => ({ supabase: {} }))

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const loc = { collection: 'bofm', book: '1-ne', chapter: 5 }

// ルートの先読みは loader のデータを返す。そこに節本文が入っている
const matchesFor = (chapter: string) => [
  { loaderData: { verseTexts: [{ verse: 1, text_html: `${chapter}章の1節` }] } },
]

beforeEach(() => {
  preloadRoute.mockReset()
  preloadRoute.mockImplementation(({ params }: { params: { chapter: string } }) =>
    Promise.resolve(matchesFor(params.chapter)),
  )
  queryVerseTexts.mockReset()
  queryVerseTexts.mockResolvedValue([{ verse: 1, text_html: 'english' }])
})

describe('useAdjacentChapterTexts', () => {
  it('前後の章をルートごと先読みし、その節本文を返す', async () => {
    const { result } = renderHook(
      () => useAdjacentChapterTexts({ loc, enabled: true, bilingual: false }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.next?.primary.get(1)).toBe('6章の1節'))
    expect(result.current.prev?.primary.get(1)).toBe('4章の1節')
    expect(result.current.next?.ref).toEqual({ collection: 'bofm', book: '1-ne', chapter: 6 })
  })

  it('無効なときは先読みしない', async () => {
    renderHook(() => useAdjacentChapterTexts({ loc, enabled: false, bilingual: false }), { wrapper })
    await new Promise((r) => setTimeout(r, 20))
    expect(preloadRoute).not.toHaveBeenCalled()
  })

  it('移動先がない方向は先読みしない', async () => {
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
    expect(preloadRoute).toHaveBeenCalledTimes(1)
  })

  it('先読みが失敗しても落ちず、その方向は空のままになる', async () => {
    preloadRoute.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(
      () => useAdjacentChapterTexts({ loc, enabled: true, bilingual: false }),
      { wrapper },
    )
    await new Promise((r) => setTimeout(r, 30))
    expect(result.current.next).toBeNull()
    expect(result.current.prev).toBeNull()
  })

  it('併記が有効なときだけ第2言語を別に取る', async () => {
    const { result } = renderHook(
      () => useAdjacentChapterTexts({ loc, enabled: true, bilingual: true }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.next?.secondary.get(1)).toBe('english'))
    expect(queryVerseTexts.mock.calls.every((c) => c[2] === 'en')).toBe(true)
  })

  it('併記が無効なら第2言語は取らない', async () => {
    const { result } = renderHook(
      () => useAdjacentChapterTexts({ loc, enabled: true, bilingual: false }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.next?.primary.size).toBe(1))
    expect(queryVerseTexts).not.toHaveBeenCalled()
  })
})
