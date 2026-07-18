import { describe, it, expect } from 'vitest'
import { parseSelection, toggleVerse, formatSelectionLabel } from '@/features/select-scripture-verses'

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

describe('formatSelectionLabel', () => {
  it('空配列は空文字列', () => {
    expect(formatSelectionLabel([])).toBe('')
  })

  it('3件以下はそのまま列挙', () => {
    expect(formatSelectionLabel([1, 2, 3])).toBe('1, 2, 3')
  })

  it('4件以上は先頭3件と件数', () => {
    expect(formatSelectionLabel([1, 2, 3, 4, 5])).toBe('1, 2, 3（他2件）')
  })
})
