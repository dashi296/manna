import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockResponse: { data: unknown; error: unknown } = { data: [], error: null }

vi.mock('@tanstack/react-router', async () => {
  const { routerMock } = await import('../../helpers/tanstack')
  return routerMock()
})

vi.mock('@tanstack/react-start', async () => (await import('../../helpers/tanstack')).startMock())

vi.mock('@/shared/lib/supabase', () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    order: () => chain,
    then: (resolve: (result: { data: unknown; error: unknown }) => void) => resolve(mockResponse),
  }
  return {
    supabase: {
      from: () => chain,
    },
  }
})

describe('queryClientVerseTexts', () => {
  beforeEach(() => {
    mockResponse = { data: [], error: null }
  })

  it('成功時は取得した行を返す', async () => {
    mockResponse = {
      data: [{ verse: 1, text_html: 'Hello' }],
      error: null,
    }
    const { queryClientVerseTexts } = await import('@/pages/scriptures/$collection/$book/$chapter')
    const rows = await queryClientVerseTexts({ collection: 'bofm', book: '1-ne', chapter: 1 })
    expect(rows).toEqual([{ verse: 1, text_html: 'Hello' }])
  })

  it('Supabase がエラーを返したときは例外を投げる（空配列を成功として返さない）', async () => {
    mockResponse = { data: null, error: { message: 'network error' } }
    const { queryClientVerseTexts } = await import('@/pages/scriptures/$collection/$book/$chapter')
    await expect(
      queryClientVerseTexts({ collection: 'bofm', book: '1-ne', chapter: 1 }),
    ).rejects.toBeTruthy()
  })
})
