import { describe, it, expect } from 'vitest'
import { isValidCursor } from '@/shared/lib/cursor'

const VALID_UUID = '11111111-2222-3333-4444-555555555555'

describe('isValidCursor', () => {
  it('PostgREST が返す timestamptz を受け付ける', () => {
    expect(isValidCursor({ createdAt: '2026-07-25T10:00:00+00:00', id: VALID_UUID })).toBe(true)
    expect(isValidCursor({ createdAt: '2026-07-25T10:00:00.123456+00:00', id: VALID_UUID })).toBe(true)
    expect(isValidCursor({ createdAt: '2026-07-25T10:00:00Z', id: VALID_UUID })).toBe(true)
  })

  it('Date.parse は通すが ISO ではない形式を弾く', () => {
    expect(isValidCursor({ createdAt: 'Jan 1, 2026', id: VALID_UUID })).toBe(false)
  })

  it('フィルタ式を壊す文字を含む値を弾く', () => {
    expect(isValidCursor({ createdAt: '2026-07-25T10:00:00+00:00"', id: VALID_UUID })).toBe(false)
    expect(isValidCursor({ createdAt: '2026-07-25T10:00:00+00:00,or(1.eq.1)', id: VALID_UUID })).toBe(false)
    expect(isValidCursor({ createdAt: '2026-07-25T10:00:00+00:00', id: `${VALID_UUID}"` })).toBe(false)
  })

  it('UUID でない id を弾く', () => {
    expect(isValidCursor({ createdAt: '2026-07-25T10:00:00+00:00', id: 'not-a-uuid' })).toBe(false)
  })
})
