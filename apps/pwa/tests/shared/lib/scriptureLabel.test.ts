import { describe, expect, it } from 'vitest'
import { getChapterLabel, getScriptureLabel, getBook } from '@/entities/scripture'

const book = (collection: string, id: string) => getBook(collection, id)!

describe('getChapterLabel', () => {
  it('通常の書は「第n章」', () => {
    expect(getChapterLabel(book('bofm', '1-ne'), 5)).toBe('第5章')
    expect(getChapterLabel(book('nt', 'matt'), 1)).toBe('第1章')
  })

  it('詩篇は「第n篇」。公式の表記に合わせる', () => {
    expect(getChapterLabel(book('ot', 'ps'), 23)).toBe('第23篇')
  })

  it('前付け文書は書名をそのまま出す', () => {
    expect(getChapterLabel(book('bofm', 'introduction'), 1)).toBe('序文')
  })
})

describe('getScriptureLabel', () => {
  it('詩篇の章ラベルが聖典参照にも効く', () => {
    expect(getScriptureLabel({ collection: 'ot', book: 'ps', chapter: 23 })).toBe('詩篇 第23篇')
  })

  it('節を指定したときは章の呼び方に依らず n:m で示す', () => {
    expect(getScriptureLabel({ collection: 'ot', book: 'ps', chapter: 23, verses: [1] })).toBe('詩篇 23:1')
  })
})
