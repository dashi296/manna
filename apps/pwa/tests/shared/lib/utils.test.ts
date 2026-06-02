import { describe, it, expect } from 'vitest'
import { cn } from '@/shared/lib/utils'

describe('cn', () => {
  it('クラス名を結合する', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('条件付きクラスを処理する', () => {
    expect(cn('base', false && 'skipped', 'added')).toBe('base added')
  })

  it('undefined / null を無視する', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
  })

  it('Tailwindの競合クラスをマージする（後勝ち）', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('引数なしで空文字を返す', () => {
    expect(cn()).toBe('')
  })
})
