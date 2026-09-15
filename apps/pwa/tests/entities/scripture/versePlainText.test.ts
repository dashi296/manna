import { describe, it, expect } from 'vitest'
import { verseHtmlToPlainText } from '@/entities/scripture'

describe('verseHtmlToPlainText', () => {
  it('ルビを落として本文だけを返す', () => {
    const html = '<ruby>両<rt>りょう</rt></ruby><ruby>親<rt>しん</rt></ruby>から'
    expect(verseHtmlToPlainText(html)).toBe('両親から')
  })

  it('ルビ非対応ブラウザ向けの括弧（rp）も落とす', () => {
    const html = '<ruby>父<rp>（</rp><rt>ちち</rt><rp>）</rp></ruby>が'
    expect(verseHtmlToPlainText(html)).toBe('父が')
  })

  it('タグの無い本文はそのまま返す', () => {
    expect(verseHtmlToPlainText('わたしニーファイは')).toBe('わたしニーファイは')
  })

  it('前後の空白を落とす', () => {
    expect(verseHtmlToPlainText('  本文  ')).toBe('本文')
  })

  it('空文字は空文字を返す', () => {
    expect(verseHtmlToPlainText('')).toBe('')
  })
})
