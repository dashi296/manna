import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAdjacentChapterTexts } from '@/features/swipe-chapter-navigation'

const queryVerseTexts = vi.fn()
vi.mock('@/entities/scripture', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/scripture')>()),
  queryScriptureVerseTexts: (...args: unknown[]) => queryVerseTexts(...args),
}))

vi.mock('@/shared/lib/supabase', () => ({ supabase: {} }))

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const loc = { collection: 'bofm', book: '1-ne', chapter: 5 }

beforeEach(() => {
  queryVerseTexts.mockReset()
  queryVerseTexts.mockImplementation((_client, ref: { chapter: number }, language: string) =>
    Promise.resolve([{ verse: 1, text_html: `${language}-${ref.chapter}` }]),
  )
})

describe('useAdjacentChapterTexts', () => {
  it('有効なとき、前後の章の節本文を取りに行く', async () => {
    const { result } = renderHook(
      () => useAdjacentChapterTexts({ loc, enabled: true, bilingual: false }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.next?.primary.size).toBe(1))
    expect(result.current.prev?.primary.get(1)).toBe('ja-4')
    expect(result.current.next?.primary.get(1)).toBe('ja-6')
  })

  it('無効なときは1件も取りに行かない', async () => {
    renderHook(() => useAdjacentChapterTexts({ loc, enabled: false, bilingual: false }), { wrapper })
    await new Promise((r) => setTimeout(r, 20))
    expect(queryVerseTexts).not.toHaveBeenCalled()
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
    expect(queryVerseTexts).toHaveBeenCalledTimes(1)
  })

  it('併記が有効なときは第2言語も取る', async () => {
    const { result } = renderHook(
      () => useAdjacentChapterTexts({ loc, enabled: true, bilingual: true }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.next?.secondary.size).toBe(1))
    expect(result.current.next?.secondary.get(1)).toBe('en-6')
  })

  it('併記が無効なら第2言語は取らない', async () => {
    const { result } = renderHook(
      () => useAdjacentChapterTexts({ loc, enabled: true, bilingual: false }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.next?.primary.size).toBe(1))
    expect(queryVerseTexts.mock.calls.every((c) => c[2] === 'ja')).toBe(true)
  })
})
