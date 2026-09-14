import { describe, it } from 'node:test'
import assert from 'node:assert'
import { parseVerses, parseChapterHeading } from './parse-verses.mjs'

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

describe('parseVerses with trailing space in verse-number (OT format)', () => {
  const OT_HTML = `
<div class="body-block">
<p class="verse" data-aid="100" id="p1"><span class="verse-number">1 </span>はじめに<ruby><rb>神</rb><rt>かみ</rt></ruby>は<ruby><rb>天</rb><rt>てん</rt></ruby>と<ruby><rb>地</rb><rt>ち</rt></ruby>とを<ruby><rb>創造</rb><rt>そうぞう</rt></ruby>された。</p>
</div>
`
  const verses = parseVerses(OT_HTML)

  it('parses verse with trailing space in verse-number span', () => {
    assert.strictEqual(verses.length, 1)
    assert.strictEqual(verses[0].verse, 1)
  })

  it('produces correct plain text', () => {
    assert.strictEqual(verses[0].text, 'はじめに神は天と地とを創造された。')
  })
})

describe('parseChapterHeading', () => {
  it('タイトルと概要を取り出す', () => {
    const heading = parseChapterHeading(`
      <p class="title-number" id="title_number1">第5章</p>
      <p class="study-summary" id="study_summary1">サライア、<ruby><rb>不</rb><rt>ふ</rt></ruby>平を言う。</p>
      <p class="verse"><span class="verse-number">1</span>本文</p>
    `)
    assert.strictEqual(heading.title, '第5章')
    assert.strictEqual(heading.summary, 'サライア、不平を言う。')
    assert.ok(heading.summaryHtml.includes('<ruby><rb>不</rb><rt>ふ</rt></ruby>'))
  })

  it('概要が無い章（旧約・新約）ではタイトルだけを返す', () => {
    const heading = parseChapterHeading(`
      <p class="title-number" id="title_number1">第1章</p>
      <p class="verse"><span class="verse-number">1</span>本文</p>
    `)
    assert.strictEqual(heading.title, '第1章')
    assert.strictEqual(heading.summary, null)
    assert.strictEqual(heading.summaryHtml, null)
  })

  it('詩篇のように章以外の呼び方でもそのまま返す', () => {
    assert.strictEqual(parseChapterHeading('<p class="title-number">第23篇</p>').title, '第23篇')
  })

  it('タイトルが無ければ null を返す（前付け文書など）', () => {
    assert.strictEqual(parseChapterHeading('<p class="verse">本文</p>'), null)
  })

  it('注釈の記号や study-note-ref は落とす', () => {
    const heading = parseChapterHeading(`
      <p class="title-number">第1章</p>
      <p class="study-summary"><a class="study-note-ref" href="#n"><sup class="marker" data-value="①"></sup>ニーファイ</a>が語る。</p>
    `)
    assert.strictEqual(heading.summary, 'ニーファイが語る。')
  })
})
