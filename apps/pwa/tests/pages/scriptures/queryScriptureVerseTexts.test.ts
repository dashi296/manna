import { describe, it, expect, vi } from 'vitest'
import { createSupabaseQueryChain } from '../../helpers/supabase'

vi.mock('@tanstack/react-router', async () => {
  const { routerMock } = await import('../../helpers/tanstack')
  return routerMock()
})

vi.mock('@tanstack/react-start', async () => (await import('../../helpers/tanstack')).startMock())

// $chapter.tsx はモジュール評価時に @/shared/lib/supabase をインポートするため、実際の
// ブラウザ用クライアント構築を避けるためだけにモックする。queryScriptureVerseTexts は
// client を引数で受け取る設計なので、テストではこのモックを直接は使わない。
vi.mock('@/shared/lib/supabase', () => ({
  supabase: {},
}))

function createMockClient(response: { data: unknown; error: unknown }) {
  return { from: () => createSupabaseQueryChain(() => response) }
}

describe('queryScriptureVerseTexts', () => {
  it('成功時は取得した行を返す', async () => {
    const { queryScriptureVerseTexts } = await import('@/pages/scriptures/$collection/$book/$chapter')
    const client = createMockClient({ data: [{ verse: 1, text_html: 'Hello' }], error: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await queryScriptureVerseTexts(client as any, { collection: 'bofm', book: '1-ne', chapter: 1 }, 'en')
    expect(rows).toEqual([{ verse: 1, text_html: 'Hello' }])
  })

  it('Supabase がエラーを返したときは例外を投げる（空配列を成功として返さない）', async () => {
    const { queryScriptureVerseTexts } = await import('@/pages/scriptures/$collection/$book/$chapter')
    const client = createMockClient({ data: null, error: { message: 'network error' } })
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      queryScriptureVerseTexts(client as any, { collection: 'bofm', book: '1-ne', chapter: 1 }, 'en'),
    ).rejects.toBeTruthy()
  })
})
