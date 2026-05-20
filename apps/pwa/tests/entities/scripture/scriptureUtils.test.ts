import { describe, it, expect } from 'vitest'
import { buildScriptureUrl, getScriptureLabel, getBook } from '@/entities/scripture'

describe('buildScriptureUrl', () => {
  it('章のURLを生成する', () => {
    const url = buildScriptureUrl({ collection: 'bofm', book: '1-ne', chapter: 3 })
    expect(url).toBe('https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=jpn')
  })

  it('単一節のURLを生成する', () => {
    const url = buildScriptureUrl({ collection: 'bofm', book: '1-ne', chapter: 3, verses: [7] })
    expect(url).toBe('https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=jpn&id=p7')
  })

  it('複数節の場合は先頭節のアンカーでURLを生成する', () => {
    const url = buildScriptureUrl({ collection: 'bofm', book: '1-ne', chapter: 3, verses: [7, 9] })
    expect(url).toBe('https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=jpn&id=p7')
  })
})

describe('getScriptureLabel', () => {
  it('単一節のラベルを返す', () => {
    const label = getScriptureLabel({ collection: 'bofm', book: '1-ne', chapter: 3, verses: [7] })
    expect(label).toBe('第1ニーファイ書 3:7')
  })

  it('節なしのラベルを返す', () => {
    const label = getScriptureLabel({ collection: 'bofm', book: '1-ne', chapter: 3 })
    expect(label).toBe('第1ニーファイ書 第3章')
  })

  it('連続節範囲のラベルを返す', () => {
    const label = getScriptureLabel({ collection: 'bofm', book: '1-ne', chapter: 3, verses: [7, 8, 9] })
    expect(label).toBe('第1ニーファイ書 3:7–9')
  })

  it('飛び番節のラベルを返す', () => {
    const label = getScriptureLabel({ collection: 'bofm', book: '1-ne', chapter: 3, verses: [7, 9] })
    expect(label).toBe('第1ニーファイ書 3:7, 9')
  })
})

describe('getBook', () => {
  it('書籍データを返す', () => {
    const book = getBook('bofm', '1-ne')
    expect(book?.name).toBe('第1ニーファイ書')
    expect(book?.chapters).toBe(22)
  })

  it('存在しない書籍はundefinedを返す', () => {
    expect(getBook('bofm', 'unknown')).toBeUndefined()
  })
})
