import { describe, it, expect } from 'vitest'
import { queryScriptureVerseTexts } from '@/entities/scripture'
import { createSupabaseQueryChain } from '../../helpers/supabase'

function createMockClient(response: { data: unknown; error: unknown }) {
  return { from: () => createSupabaseQueryChain(() => response) }
}

const loc = { collection: 'bofm', book: '1-ne', chapter: 1 }

describe('queryScriptureVerseTexts', () => {
  it('成功時は取得した行を返す', async () => {
    const client = createMockClient({ data: [{ verse: 1, text_html: 'Hello' }], error: null })
    const rows = await queryScriptureVerseTexts(client as any, loc, 'en')
    expect(rows).toEqual([{ verse: 1, text_html: 'Hello' }])
  })

  it('Supabase がエラーを返したときは例外を投げる（空配列を成功として返さない）', async () => {
    const client = createMockClient({ data: null, error: { message: 'network error' } })
    await expect(queryScriptureVerseTexts(client as any, loc, 'en')).rejects.toBeTruthy()
  })
})
