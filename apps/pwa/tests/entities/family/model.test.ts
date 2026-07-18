import { describe, it, expect } from 'vitest'
import { familyPairFilter } from '@/entities/family'

describe('familyPairFilter', () => {
  it('双方向のORフィルタ文字列を生成する', () => {
    const result = familyPairFilter('user-a', 'user-b')
    expect(result).toBe(
      'and(requester_id.eq.user-a,addressee_id.eq.user-b),' +
      'and(requester_id.eq.user-b,addressee_id.eq.user-a)',
    )
  })

  it('引数の順序を入れ替えても両方向を含む', () => {
    const ab = familyPairFilter('x', 'y')
    const ba = familyPairFilter('y', 'x')
    expect(ab).toContain('requester_id.eq.x')
    expect(ab).toContain('requester_id.eq.y')
    expect(ba).toContain('requester_id.eq.x')
    expect(ba).toContain('requester_id.eq.y')
  })

  it('UUIDを正しく埋め込む', () => {
    const uuid1 = '550e8400-e29b-41d4-a716-446655440000'
    const uuid2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
    const result = familyPairFilter(uuid1, uuid2)
    expect(result).toContain(`requester_id.eq.${uuid1}`)
    expect(result).toContain(`addressee_id.eq.${uuid2}`)
    expect(result).toContain(`requester_id.eq.${uuid2}`)
    expect(result).toContain(`addressee_id.eq.${uuid1}`)
  })
})
