import { readFileSync } from 'node:fs'
import { parseVerses } from './lib/parse-verses.mjs'
import { parseParagraphs } from './lib/parse-paragraphs.mjs'
import { runPsql } from './lib/db.mjs'
import { resolveLanguage } from './lib/languages.mjs'

const API_BASE = 'https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content'
const RATE_MS = 1000
const MAX_RETRIES = 3

const scriptures = JSON.parse(
  readFileSync(new URL('../apps/pwa/src/shared/config/scriptures.json', import.meta.url), 'utf8')
)

function parseArgs() {
  const langArg = process.argv.find(arg => arg.startsWith('--lang='))
  const langCode = langArg ? langArg.slice('--lang='.length) : 'ja'
  return resolveLanguage(langCode)
}

function buildChapterList() {
  const chapters = []
  for (const col of scriptures.collections) {
    for (const book of col.books) {
      for (let ch = 1; ch <= book.chapters; ch++) {
        chapters.push({
          collectionId: col.id,
          bookId: book.id,
          chapter: ch,
          expectedVerses: book.verses[ch - 1],
          isFrontMatter: book.isFrontMatter,
        })
      }
    }
  }
  return chapters
}

function getCompletedChapters(languageCode) {
  const result = runPsql(
    `SELECT collection_id, book_id, chapter, COUNT(*) FROM scripture_verses WHERE language='${sqlQuote(languageCode)}' GROUP BY collection_id, book_id, chapter;`
  )
  const map = new Map()
  for (const line of result.trim().split('\n').filter(Boolean)) {
    const [collectionId, bookId, chapter, count] = line.split('|')
    map.set(`${collectionId}/${bookId}/${chapter}`, parseInt(count, 10))
  }
  return map
}

async function fetchChapter(collectionId, bookId, chapter, isFrontMatter, apiCode) {
  const uri = isFrontMatter
    ? `/scriptures/${collectionId}/${bookId}`
    : `/scriptures/${collectionId}/${bookId}/${chapter}`
  const url = `${API_BASE}?lang=${apiCode}&uri=${uri}`

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      return data.content.body
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err
      const delay = RATE_MS * 2 ** attempt
      console.error(`  Retry ${attempt}/${MAX_RETRIES} after ${delay}ms: ${err.message}`)
      await sleep(delay)
    }
  }
}

function sqlQuote(s) {
  // Postgres standard string literal escaping: only single quotes need doubling.
  // Backslashes and dollar signs are safe inside '...' literals as long as
  // standard_conforming_strings is on (the Postgres default since 9.1).
  return s.replace(/'/g, "''")
}

function insertVerses(collectionId, bookId, chapter, verses, languageCode) {
  const values = verses.map(v => {
    return `('${sqlQuote(collectionId)}','${sqlQuote(bookId)}',${chapter},${v.verse},'${sqlQuote(v.text)}','${sqlQuote(v.textHtml)}','${sqlQuote(languageCode)}')`
  })

  const sql = `INSERT INTO scripture_verses (collection_id, book_id, chapter, verse, text, text_html, language) VALUES ${values.join(',')};`
  runPsql(sql)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const language = parseArgs()
  const allChapters = buildChapterList()
  const completedCounts = getCompletedChapters(language.code)
  const todo = allChapters.filter(c => {
    const key = `${c.collectionId}/${c.bookId}/${c.chapter}`
    const count = completedCounts.get(key)
    return count === undefined || count !== c.expectedVerses
  })

  console.log(`Language: ${language.code} (${language.label})`)
  console.log(`Total: ${allChapters.length} chapters, Skipping: ${allChapters.length - todo.length}, Remaining: ${todo.length}`)

  let inserted = 0
  for (let i = 0; i < todo.length; i++) {
    const { collectionId, bookId, chapter, expectedVerses, isFrontMatter } = todo[i]
    const label = `${collectionId}/${bookId}/${chapter}`

    try {
      const html = await fetchChapter(collectionId, bookId, chapter, isFrontMatter, language.apiCode)
      const verses = isFrontMatter ? parseParagraphs(html) : parseVerses(html)

      if (verses.length !== expectedVerses) {
        console.warn(`Warning: Expected ${expectedVerses} verses but parsed ${verses.length} for ${label}`)
      }

      if (verses.length > 0) {
        if (completedCounts.has(label)) {
          runPsql(`DELETE FROM scripture_verses WHERE collection_id='${sqlQuote(collectionId)}' AND book_id='${sqlQuote(bookId)}' AND chapter=${chapter} AND language='${sqlQuote(language.code)}';`)
        }
        insertVerses(collectionId, bookId, chapter, verses, language.code)
        inserted += verses.length
      }

      console.log(`[${i + 1}/${todo.length}] ${label} ... ${verses.length} verses`)
    } catch (err) {
      console.error(`[${i + 1}/${todo.length}] ${label} FAILED: ${err.message}`)
    }

    if (i < todo.length - 1) await sleep(RATE_MS)
  }

  console.log(`\nDone: ${inserted} verses inserted`)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
