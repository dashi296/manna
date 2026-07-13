import { describe, it } from 'node:test'
import assert from 'node:assert'
import { parseVerses } from './parse-verses.mjs'

const SAMPLE_HTML = `
<header><h1 data-aid="1" id="title1">Title</h1></header>
<p class="study-summary" data-aid="2" id="study_summary1">Summary text</p>
<p class="verse" data-aid="3" id="p1"><span class="verse-number">1</span>わたし<a class="study-note-ref" href="#note1_a"><sup class="marker" data-value="①"></sup>ニーファイ</a>は<ruby><rb>善</rb><rt>よ</rt></ruby>い<ruby><rb>両</rb><rt>りょう</rt></ruby><ruby><rb>親</rb><rt>しん</rt></ruby>から<ruby><rb>生</rb><rt>う</rt></ruby>まれた。</p>
<p class="verse" data-aid="4" id="p2"><span class="verse-number">2</span>まことにわたしは<ruby><rb>父</rb><rt>ちち</rt></ruby>の<ruby><rb>言</rb><rt>こと</rt></ruby><ruby><rb>葉</rb><rt>ば</rt></ruby>で<ruby><rb>記</rb><rt>き</rt></ruby><ruby><rb>録</rb><rt>ろく</rt></ruby>する。</p>
`

describe('parseVerses', () => {
  const verses = parseVerses(SAMPLE_HTML)

  it('extracts correct number of verses', () => {
    assert.strictEqual(verses.length, 2)
  })

  it('extracts verse numbers', () => {
    assert.strictEqual(verses[0].verse, 1)
    assert.strictEqual(verses[1].verse, 2)
  })

  it('produces plain text without HTML tags', () => {
    assert.strictEqual(verses[0].text, 'わたしニーファイは善い両親から生まれた。')
  })

  it('preserves ruby tags in textHtml', () => {
    assert.ok(verses[0].textHtml.includes('<ruby><rb>善</rb><rt>よ</rt></ruby>'))
  })

  it('removes study-note-ref tags but keeps inner text', () => {
    assert.ok(!verses[0].textHtml.includes('study-note-ref'))
    assert.ok(verses[0].textHtml.includes('ニーファイ'))
  })

  it('removes sup.marker elements', () => {
    assert.ok(!verses[0].textHtml.includes('marker'))
    assert.ok(!verses[0].textHtml.includes('①'))
  })

  it('removes verse-number span', () => {
    assert.ok(!verses[0].textHtml.includes('verse-number'))
    assert.ok(!verses[0].text.startsWith('1'))
  })

  it('ignores non-verse paragraphs', () => {
    assert.ok(verses.every(v => v.verse > 0))
  })
})
