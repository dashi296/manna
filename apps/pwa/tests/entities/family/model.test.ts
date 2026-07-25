import { describe, it, expect, vi } from 'vitest'
import { filterFamilyPair } from '@/entities/family'

const builder = () => {
  const calls: [string, string[]][] = []
  const query = {
    calls,
    in: vi.fn((column: string, values: string[]) => {
      calls.push([column, values])
      return query
    }),
  }
  return query
}

describe('filterFamilyPair', () => {
  it('requester/addressee の両列を2人組に絞る', () => {
    const query = builder()
    filterFamilyPair(query, 'user-a', 'user-b')
    expect(query.calls).toEqual([
      ['requester_id', ['user-a', 'user-b']],
      ['addressee_id', ['user-a', 'user-b']],
    ])
  })

  it('引数の順序を入れ替えても同じ2人組を対象にする', () => {
    const ab = builder()
    const ba = builder()
    filterFamilyPair(ab, 'x', 'y')
    filterFamilyPair(ba, 'y', 'x')
    expect(ab.calls.map(([col, v]) => [col, [...v].sort()])).toEqual(
      ba.calls.map(([col, v]) => [col, [...v].sort()]),
    )
  })

  it('id を値として渡すだけで、フィルタ式を組み立てない', () => {
    const query = builder()
    // PostgREST のフィルタ構文を仕込んだ値を渡しても、式ではなく値のまま扱われる
    const injected = 'x,or(status.eq.accepted)'
    filterFamilyPair(query, injected, 'y')
    for (const [, values] of query.calls) {
      expect(values).toContain(injected)
    }
  })

  it('絞り込んだクエリをそのまま返す', () => {
    const query = builder()
    expect(filterFamilyPair(query, 'a', 'b')).toBe(query)
  })
})
