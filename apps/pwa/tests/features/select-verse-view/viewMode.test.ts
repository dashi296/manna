import { describe, it, expect } from 'vitest'
import { parseViewMode } from '@/features/select-verse-view/model/viewMode'

describe('parseViewMode', () => {
  it("'who' を渡すと 'who' を返す", () => {
    expect(parseViewMode('who')).toBe('who')
  })

  it("undefined は 'count' にフォールバック", () => {
    expect(parseViewMode(undefined)).toBe('count')
  })

  it("それ以外の文字列は 'count'", () => {
    expect(parseViewMode('foo')).toBe('count')
    expect(parseViewMode('count')).toBe('count')
  })

  it('非文字列は count', () => {
    expect(parseViewMode(1)).toBe('count')
    expect(parseViewMode(null)).toBe('count')
  })
})
