import { describe, it, expect } from 'vitest'
import { parseSelection, toggleVerse, parseMode } from '@/features/select-scripture-verses'

describe('parseSelection', () => {
  it('undefined を空配列にする', () => {
    expect(parseSelection(undefined, 30)).toEqual([])
  })

  it('単一値を配列にする', () => {
    expect(parseSelection(5, 30)).toEqual([5])
  })

  it('文字列でも数値に変換する', () => {
    expect(parseSelection(['1', '2', '3'], 30)).toEqual([1, 2, 3])
  })

  it('不正値・範囲外を除外する', () => {
    expect(parseSelection(['abc', '-1', '0', '5', '999'], 30)).toEqual([5])
  })

  it('重複を除去してソートする', () => {
    expect(parseSelection([3, 1, 2, 1], 30)).toEqual([1, 2, 3])
  })

  it('カンマ区切り文字列を分割する', () => {
    expect(parseSelection('1,3,5', 30)).toEqual([1, 3, 5])
    expect(parseSelection(['1,3', '5'], 30)).toEqual([1, 3, 5])
    expect(parseSelection('abc,-1,0,4', 30)).toEqual([4])
  })

  it('maxVerse を省略すると上限なしでパースする', () => {
    expect(parseSelection('1,3,999')).toEqual([1, 3, 999])
  })
})

describe('toggleVerse', () => {
  it('未選択の節を追加する', () => {
    expect(toggleVerse([1, 3], 2)).toEqual([1, 2, 3])
  })

  it('選択済みの節を外す', () => {
    expect(toggleVerse([1, 2, 3], 2)).toEqual([1, 3])
  })

  it('結果は常にソート済み', () => {
    expect(toggleVerse([5, 1], 3)).toEqual([1, 3, 5])
  })
})

describe('parseMode', () => {
  it("'select' を渡すと 'select' を返す", () => {
    expect(parseMode('select')).toBe('select')
  })

  it("undefined は 'read' にフォールバック", () => {
    expect(parseMode(undefined)).toBe('read')
  })

  it("不正な値は 'read' にフォールバック", () => {
    expect(parseMode('foo')).toBe('read')
    expect(parseMode(42)).toBe('read')
    expect(parseMode(null)).toBe('read')
  })
})
