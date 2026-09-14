import { describe, expect, it, vi } from 'vitest'

// 動的 import で毎回解決すると、同時に走る取得がそれぞれ別のクライアントを掴む。
// テストではモジュールのモックをすり抜けて実 DB を叩いていた
let created = 0
vi.mock('@/shared/lib/supabase', () => {
  created += 1
  return { supabase: { id: created } }
})

describe('getVerseTextClient', () => {
  it('同時に呼んでも同じクライアントを返し、解決は1回だけ', async () => {
    const { getVerseTextClient } = await import('@/entities/scripture/lib/verseTextsQuery')
    const [a, b, c] = await Promise.all([
      getVerseTextClient(),
      getVerseTextClient(),
      getVerseTextClient(),
    ])
    expect(a).toBe(b)
    expect(b).toBe(c)
    expect(created).toBe(1)
  })
})
