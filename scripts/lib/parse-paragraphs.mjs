import { cleanVerseHtml } from './parse-verses.mjs'

export function parseParagraphs(html) {
  const paragraphs = []
  const pRegex = /<p[^>]*>\s*(.*?)\s*<\/p>/gs

  let match
  let verseNum = 0
  while ((match = pRegex.exec(html)) !== null) {
    verseNum += 1
    const innerHtml = match[1]
    const { text, textHtml } = cleanVerseHtml(innerHtml)
    paragraphs.push({ verse: verseNum, text, textHtml })
  }

  return paragraphs
}
