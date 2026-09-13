import { describe, it, expect } from 'vitest'
import { getAdjacentChapterRef } from '@/entities/scripture'

describe('getAdjacentChapterRef', () => {
  it('同じ書の中で次の章を返す', () => {
    expect(getAdjacentChapterRef({ collection: 'bofm', book: '1-ne', chapter: 5 }, 'next'))
      .toEqual({ collection: 'bofm', book: '1-ne', chapter: 6 })
  })

  it('同じ書の中で前の章を返す', () => {
    expect(getAdjacentChapterRef({ collection: 'bofm', book: '1-ne', chapter: 5 }, 'prev'))
      .toEqual({ collection: 'bofm', book: '1-ne', chapter: 4 })
  })

  it('書の最終章から次の書の1章目へまたぐ', () => {
    expect(getAdjacentChapterRef({ collection: 'bofm', book: '1-ne', chapter: 22 }, 'next'))
      .toEqual({ collection: 'bofm', book: '2-ne', chapter: 1 })
  })

  it('書の1章目から前の書の最終章へまたぐ', () => {
    expect(getAdjacentChapterRef({ collection: 'bofm', book: '2-ne', chapter: 1 }, 'prev'))
      .toEqual({ collection: 'bofm', book: '1-ne', chapter: 22 })
  })

  it('1章のみの書同士でも前後にまたげる（前付け文書ではないため）', () => {
    expect(getAdjacentChapterRef({ collection: 'bofm', book: 'jarom', chapter: 1 }, 'prev'))
      .toEqual({ collection: 'bofm', book: 'enos', chapter: 1 })
    expect(getAdjacentChapterRef({ collection: 'bofm', book: 'enos', chapter: 1 }, 'next'))
      .toEqual({ collection: 'bofm', book: 'jarom', chapter: 1 })
  })

  it('前付け文書は前方スキップの対象になる（js証の次は1-neの1章）', () => {
    expect(getAdjacentChapterRef({ collection: 'bofm', book: 'js', chapter: 1 }, 'next'))
      .toEqual({ collection: 'bofm', book: '1-ne', chapter: 1 })
  })

  it('前付け文書は後方スキップの対象になる（1-neの1章の前は前付け文書を全て飛ばしてnull）', () => {
    expect(getAdjacentChapterRef({ collection: 'bofm', book: '1-ne', chapter: 1 }, 'prev'))
      .toBeNull()
  })

  it('コレクション末尾（moro最終章）の次はnull', () => {
    expect(getAdjacentChapterRef({ collection: 'bofm', book: 'moro', chapter: 10 }, 'next'))
      .toBeNull()
  })

  it('単一書のみのコレクション（dc-testament）では境界を越えられずnull', () => {
    expect(getAdjacentChapterRef({ collection: 'dc-testament', book: 'dc', chapter: 138 }, 'next'))
      .toBeNull()
    expect(getAdjacentChapterRef({ collection: 'dc-testament', book: 'dc', chapter: 1 }, 'prev'))
      .toBeNull()
  })

  it('コレクション先頭（pgpのmoses 1章）の前はnull', () => {
    expect(getAdjacentChapterRef({ collection: 'pgp', book: 'moses', chapter: 1 }, 'prev'))
      .toBeNull()
  })

  it('存在しない書はnullを返す', () => {
    expect(getAdjacentChapterRef({ collection: 'bofm', book: 'unknown', chapter: 1 }, 'next'))
      .toBeNull()
  })
})
