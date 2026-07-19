import { describe, it, expect } from 'vitest'
import { parseViewMode, serializeViewMode } from '@/features/select-verse-view'

describe('parseViewMode', () => {
  it("'who' → 'who'", () => {
    expect(parseViewMode('who')).toBe('who')
  })
  it('undefined → count', () => {
    expect(parseViewMode(undefined)).toBe('count')
  })
  it('その他文字列 → count', () => {
    expect(parseViewMode('foo')).toBe('count')
    expect(parseViewMode('count')).toBe('count')
  })
  it('非文字列 → count', () => {
    expect(parseViewMode(1)).toBe('count')
    expect(parseViewMode(null)).toBe('count')
  })
})

describe('serializeViewMode', () => {
  it("'who' → 'who'", () => {
    expect(serializeViewMode('who')).toBe('who')
  })
  it("'count' → undefined", () => {
    expect(serializeViewMode('count')).toBeUndefined()
  })
})
