import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { parseVerses } from './lib/parse-verses.mjs'

const DB_URL = process.env.DATABASE_URL
  || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const API_BASE = 'https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content'
const RATE_MS = 1000
const MAX_RETRIES = 3

const scriptures = JSON.parse(
  readFileSync(new URL('../apps/pwa/src/shared/config/scriptures.json', import.meta.url), 'utf8')
)

function buildChapterList() {
  const chapters = []
  for (const col of scriptures.collections) {
    for (const book of col.books) {
      for (let ch = 1; ch <= book.chapters; ch++) {
        chapters.push({
          collectionId: col.id,
          bookId: book.id,
          chapter: ch,
        })
      }
    }
  }
  return chapters
}

function runPsql(sql) {
  return execFileSync('psql', [DB_URL, '-t', '-A'], {
    input: sql,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

function getCompletedChapters() {
  const result = runPsql(
    `SELECT collection_id || '/' || book_id || '/' || chapter FROM scripture_verses GROUP BY collection_id, book_id, chapter;`
  )
  return new Set(result.trim().split('\n').filter(Boolean))
}

async function fetchChapter(collectionId, bookId, chapter) {
  const uri = `/scriptures/${collectionId}/${bookId}/${chapter}`
  const url = `${API_BASE}?lang=jpn&uri=${uri}`

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

function insertVerses(collectionId, bookId, chapter, verses) {
  const values = verses.map(v => {
    return `('${sqlQuote(collectionId)}','${sqlQuote(bookId)}',${chapter},${v.verse},'${sqlQuote(v.text)}','${sqlQuote(v.textHtml)}')`
  })

  const sql = `INSERT INTO scripture_verses (collection_id, book_id, chapter, verse, text, text_html) VALUES ${values.join(',')};`
  execFileSync('psql', [DB_URL], { input: sql, stdio: ['pipe', 'pipe', 'pipe'] })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const allChapters = buildChapterList()
  const completed = getCompletedChapters()
  const todo = allChapters.filter(
    c => !completed.has(`${c.collectionId}/${c.bookId}/${c.chapter}`)
  )

  console.log(`Total: ${allChapters.length} chapters, Skipping: ${completed.size}, Remaining: ${todo.length}`)

  let inserted = 0
  for (let i = 0; i < todo.length; i++) {
    const { collectionId, bookId, chapter } = todo[i]
    const label = `${collectionId}/${bookId}/${chapter}`

    try {
      const html = await fetchChapter(collectionId, bookId, chapter)
      const verses = parseVerses(html)

      if (verses.length > 0) {
        insertVerses(collectionId, bookId, chapter, verses)
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

main()
