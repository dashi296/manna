export function parseVerses(html) {
  const verses = []
  const verseRegex = /<p class="verse"[^>]*>\s*(.*?)\s*<\/p>/gs

  let match
  while ((match = verseRegex.exec(html)) !== null) {
    const innerHtml = match[1]

    const verseNumMatch = innerHtml.match(/<span class="verse-number">(\d+)<\/span>/)
    if (!verseNumMatch) continue
    const verseNum = parseInt(verseNumMatch[1], 10)

    let cleaned = innerHtml
    // Remove verse-number span
    cleaned = cleaned.replace(/<span class="verse-number">\d+<\/span>/, '')
    // Remove sup.marker elements
    cleaned = cleaned.replace(/<sup class="marker"[^>]*>.*?<\/sup>/g, '')
    // Unwrap study-note-ref anchors (keep inner text)
    cleaned = cleaned.replace(/<a class="study-note-ref"[^>]*>(.*?)<\/a>/gs, '$1')
    // Remove any remaining non-ruby tags for textHtml
    const textHtml = cleaned
      .replace(/<(?!\/?ruby|\/?rb|\/?rt)[^>]+>/g, '')
      .trim()

    // Plain text: extract rb content from ruby tags, strip all other tags
    let plainText = cleaned
      // Replace ruby tags with just their rb content
      .replace(/<ruby>.*?<rb>([^<]*)<\/rb>.*?<\/ruby>/g, '$1')
      // Strip remaining tags
      .replace(/<[^>]+>/g, '')
      .trim()
    const text = plainText

    verses.push({ verse: verseNum, text, textHtml })
  }

  return verses
}
