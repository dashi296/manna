import { describe, it, expect } from 'vitest'
import { buildScriptureUrl, getScriptureLabel, getBook, getCollection, getAllCollections } from '@/entities/scripture'

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

  it('front matter の書は章番号セグメントを省いたURLを生成する（302リダイレクト回避）', () => {
    const url = buildScriptureUrl({ collection: 'bofm', book: 'introduction', chapter: 1 })
    expect(url).toBe('https://www.churchofjesuschrist.org/study/scriptures/bofm/introduction?lang=jpn')
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

  it('front matter の書は節指定なしでは書名のみを返す', () => {
    const label = getScriptureLabel({ collection: 'bofm', book: 'introduction', chapter: 1 })
    expect(label).toBe('序文')
  })

  it('front matter の書でも節指定があれば通常の 章:節 形式を返す', () => {
    const label = getScriptureLabel({ collection: 'bofm', book: 'introduction', chapter: 1, verses: [4] })
    expect(label).toBe('序文 1:4')
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

describe('getCollection', () => {
  it('コレクションデータを返す', () => {
    const col = getCollection('bofm')
    expect(col?.id).toBe('bofm')
    expect(Array.isArray(col?.books)).toBe(true)
  })

  it('存在しないコレクションはundefinedを返す', () => {
    expect(getCollection('unknown')).toBeUndefined()
  })
})

describe('getAllCollections', () => {
  it('全5コレクションを返す', () => {
    const cols = getAllCollections()
    expect(cols).toHaveLength(5)
    expect(cols.map((c) => c.id)).toEqual(['bofm', 'dc-testament', 'pgp', 'ot', 'nt'])
  })
})
