import { describe, it, expect } from 'vitest'
import { sanitizeVerseHtml } from '@/shared/lib/sanitizeVerseHtml'

const ALLOWED = new Set(['RUBY', 'RB', 'RT'])

// 出力をブラウザと同じ規則で解析し、許可したタグ以外の要素・属性が1つも無いことを確かめる
function parsedElements(html: string) {
  const doc = new DOMParser().parseFromString(`<span>${html}</span>`, 'text/html')
  return [...doc.body.querySelectorAll('span *')]
}

describe('sanitizeVerseHtml', () => {
  it('ルビ付きの本文はそのまま通す', () => {
    const html = 'わたしニーファイは<ruby><rb>善</rb><rt>よ</rt></ruby>い'
    expect(sanitizeVerseHtml(html)).toBe(html)
  })

  it('タグを含まない本文はそのまま通す', () => {
    expect(sanitizeVerseHtml('And it came to pass')).toBe('And it came to pass')
  })

  it('本文中の & < > をエスケープする', () => {
    expect(sanitizeVerseHtml('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d')
  })

  it.each([
    ['script', 'テスト<script>alert("xss")</script>テキスト'],
    ['img の onerror', '<img src=x onerror=alert(1)>'],
    ['属性付きの許可タグ', '<ruby onclick="alert(1)"><rb>善</rb></ruby>'],
    ['大文字の許可タグ', '<RUBY>善</RUBY>'],
    ['空白入りの許可タグ', '<ruby >善</ruby >'],
    ['自己終了の許可タグ', '<ruby/>善'],
    ['閉じていないタグ', '善<rt'],
    ['タグの中に別のタグ', '<rb<script>>善'],
    ['svg', '<svg><script>alert(1)</script></svg>'],
    ['コメント', '<!--<script>alert(1)</script>-->'],
    ['エスケープ済みの script', '&lt;script&gt;alert(1)&lt;/script&gt;'],
  ])('%s から許可外の要素や属性を作らない', (_, input) => {
    const out = sanitizeVerseHtml(input)
    for (const el of parsedElements(out)) {
      expect(ALLOWED.has(el.tagName)).toBe(true)
      expect(el.attributes).toHaveLength(0)
    }
  })

  it('許可外のタグは外し、中身の文字は残す', () => {
    expect(sanitizeVerseHtml('<b>善</b>い')).toBe('善い')
    expect(sanitizeVerseHtml('<span class="x">善</span>')).toBe('善')
  })

  it('許可タグの属性は落とし、大文字は小文字にそろえる', () => {
    expect(sanitizeVerseHtml('<RUBY onclick="alert(1)"><rb>善</rb></RUBY>')).toBe(
      '<ruby><rb>善</rb></ruby>',
    )
  })

  it('タグの形をしていない < は文字として残す', () => {
    expect(sanitizeVerseHtml('a <rt b')).toBe('a &lt;rt b')
    expect(sanitizeVerseHtml('<!--x-->')).toBe('&lt;!--x--&gt;')
  })

  it('エスケープ済みの文字列は二重にエスケープして文字のまま残す', () => {
    expect(sanitizeVerseHtml('&lt;script&gt;')).toBe('&amp;lt;script&amp;gt;')
  })

  it('閉じていない許可タグは末尾で閉じる', () => {
    expect(sanitizeVerseHtml('<ruby><rb>善')).toBe('<ruby><rb>善</rb></ruby>')
  })

  it('対応する開きタグが無い閉じタグは捨てる', () => {
    expect(sanitizeVerseHtml('善</rt>い')).toBe('善い')
    expect(sanitizeVerseHtml('<ruby>善</rb></ruby>')).toBe('<ruby>善</ruby>')
  })
})
