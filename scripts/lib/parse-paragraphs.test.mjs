import { describe, it } from 'node:test'
import assert from 'node:assert'
import { parseParagraphs } from './parse-paragraphs.mjs'

const SAMPLE_HTML = `
<header><h1 data-aid="1" id="title1">序文</h1></header>
<p class="subtitle" data-aid="2" id="p1">わたしニーファイは<ruby><rb>善</rb><rt>よ</rt></ruby>い<ruby><rb>両</rb><rt>りょう</rt></ruby><ruby><rb>親</rb><rt>しん</rt></ruby>から<ruby><rb>生</rb><rt>う</rt></ruby>まれた。</p>
<p data-aid="3" id="p2">まことにわたしは<a class="study-note-ref" href="#note1_a"><sup class="marker" data-value="①"></sup>父</a>の<ruby><rb>言</rb><rt>こと</rt></ruby><ruby><rb>葉</rb><rt>ば</rt></ruby>で<ruby><rb>記</rb><rt>き</rt></ruby><ruby><rb>録</rb><rt>ろく</rt></ruby>する。</p>
<p class="signature" data-aid="4" id="p3">モルモンによって</p>
`

describe('parseParagraphs', () => {
  const paragraphs = parseParagraphs(SAMPLE_HTML)

  it('extracts every <p> paragraph regardless of class', () => {
    assert.strictEqual(paragraphs.length, 3)
  })

  it('assigns sequential verse numbers starting at 1', () => {
    assert.strictEqual(paragraphs[0].verse, 1)
    assert.strictEqual(paragraphs[1].verse, 2)
    assert.strictEqual(paragraphs[2].verse, 3)
  })

  it('produces plain text without HTML tags', () => {
    assert.strictEqual(paragraphs[0].text, 'わたしニーファイは善い両親から生まれた。')
    assert.strictEqual(paragraphs[2].text, 'モルモンによって')
  })

  it('preserves ruby tags in textHtml', () => {
    assert.ok(paragraphs[0].textHtml.includes('<ruby><rb>善</rb><rt>よ</rt></ruby>'))
  })

  it('removes study-note-ref tags but keeps inner text', () => {
    assert.ok(!paragraphs[1].textHtml.includes('study-note-ref'))
    assert.ok(paragraphs[1].textHtml.includes('父'))
  })

  it('removes sup.marker elements', () => {
    assert.ok(!paragraphs[1].textHtml.includes('marker'))
    assert.ok(!paragraphs[1].textHtml.includes('①'))
  })
})
