import { describe, expect, it, vi } from 'vitest'

// 呼び出しごとに動的 import を張ると、同時に走る取得がそれぞれ別の解決を待つ。
// テストではモジュールのモックをすり抜けて実 DB を叩いていた。
// 動的 import はモジュールキャッシュに乗るため「同じオブジェクトが返るか」では
// 巻き戻しを検出できない。返す Promise 自体が同一かで固定する
vi.mock('@/shared/lib/supabase', () => ({ supabase: { marker: 'mock' } }))

describe('getVerseTextClient', () => {
  it('毎回まったく同じ Promise を返す（解決は1回きり）', async () => {
    const { getVerseTextClient } = await import('@/entities/scripture/lib/verseTextsQuery')
    const first = getVerseTextClient()
    const second = getVerseTextClient()
    expect(first).toBe(second)
    expect(await first).toBe(await second)
  })

  it('モックしたクライアントを返す（実クライアントを作らない）', async () => {
    const { getVerseTextClient } = await import('@/entities/scripture/lib/verseTextsQuery')
    expect(await getVerseTextClient()).toEqual({ marker: 'mock' })
  })
})
