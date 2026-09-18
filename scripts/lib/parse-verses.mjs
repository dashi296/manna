export function cleanVerseHtml(innerHtml) {
  // Remove sup.marker elements
  let cleaned = innerHtml.replace(/<sup class="marker"[^>]*>.*?<\/sup>/g, '')
  // Unwrap study-note-ref anchors (keep inner text)
  cleaned = cleaned.replace(/<a class="study-note-ref"[^>]*>(.*?)<\/a>/gs, '$1')
  // Remove any remaining non-ruby tags for textHtml
  const textHtml = cleaned.replace(/<(?!\/?ruby|\/?rb|\/?rt)[^>]+>/g, '').trim()

  // Plain text: extract rb content from ruby tags, strip all other tags
  const text = cleaned
    .replace(/<ruby>.*?<rb>([^<]*)<\/rb>.*?<\/ruby>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim()

  return { text, textHtml }
}

export function parseVerses(html) {
  const verses = []
  const verseRegex = /<p class="verse"[^>]*>\s*(.*?)\s*<\/p>/gs

  let match
  while ((match = verseRegex.exec(html)) !== null) {
    const innerHtml = match[1]

    const verseNumMatch = innerHtml.match(/<span class="verse-number">(\d+)\s*<\/span>/)
    if (!verseNumMatch) continue
    const verseNum = parseInt(verseNumMatch[1], 10)

    const withoutVerseNumber = innerHtml.replace(/<span class="verse-number">\d+\s*<\/span>/, '')
    const { text, textHtml } = cleanVerseHtml(withoutVerseNumber)

    verses.push({ verse: verseNum, text, textHtml })
  }

  return verses
}

// 章のタイトルと概要文。概要があるのは回復された聖典だけで、
// 旧約・新約には段落自体が無い。前付け文書にはタイトルも無い
export function parseChapterHeading(html) {
  const titleMatch = html.match(/<p class="title-number"[^>]*>\s*(.*?)\s*<\/p>/s)
  if (!titleMatch) return null

  const { text: title } = cleanVerseHtml(titleMatch[1])

  const summaryMatch = html.match(/<p class="study-summary"[^>]*>\s*(.*?)\s*<\/p>/s)
  if (!summaryMatch) return { title, summary: null, summaryHtml: null }

  const { text, textHtml } = cleanVerseHtml(summaryMatch[1])
  return { title, summary: text, summaryHtml: textHtml }
}
