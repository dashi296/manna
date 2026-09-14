import { readFileSync } from 'node:fs'
import { parseVerses, parseChapterHeading } from './lib/parse-verses.mjs'
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

function getCompletedHeadings(languageCode) {
  const result = runPsql(
    `SELECT collection_id, book_id, chapter FROM scripture_chapter_headings WHERE language='${sqlQuote(languageCode)}';`
  )
  const set = new Set()
  for (const line of result.trim().split('\n').filter(Boolean)) {
    const [collectionId, bookId, chapter] = line.split('|')
    set.add(`${collectionId}/${bookId}/${chapter}`)
  }
  return set
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

function upsertHeading(collectionId, bookId, chapter, heading, languageCode) {
  const nullable = v => (v === null || v === undefined ? 'NULL' : `'${sqlQuote(v)}'`)
  const sql = `INSERT INTO scripture_chapter_headings
      (collection_id, book_id, chapter, language, title, summary, summary_html)
    VALUES ('${sqlQuote(collectionId)}','${sqlQuote(bookId)}',${chapter},'${sqlQuote(languageCode)}',
      '${sqlQuote(heading.title)}',${nullable(heading.summary)},${nullable(heading.summaryHtml)})
    ON CONFLICT (collection_id, book_id, chapter, language) DO UPDATE
      SET title = EXCLUDED.title,
          summary = EXCLUDED.summary,
          summary_html = EXCLUDED.summary_html;`
  runPsql(sql)
}

async function main() {
  const language = parseArgs()
  const allChapters = buildChapterList()
  const completedCounts = getCompletedChapters(language.code)
  const completedHeadings = getCompletedHeadings(language.code)
  // 節が揃っていない章か、見出しがまだ無い章。どちらも同じレスポンスから取れるので
  // 通信は1章あたり1回のまま
  const todo = allChapters
    .map(c => {
      const key = `${c.collectionId}/${c.bookId}/${c.chapter}`
      const count = completedCounts.get(key)
      return {
        ...c,
        versesMissing: count === undefined || count !== c.expectedVerses,
        // 前付け文書には章のタイトルが無いので、見出しの有無では判定しない
        headingMissing: !c.isFrontMatter && !completedHeadings.has(key),
      }
    })
    .filter(c => c.versesMissing || c.headingMissing)

  console.log(`Language: ${language.code} (${language.label})`)
  console.log(`Total: ${allChapters.length} chapters, Skipping: ${allChapters.length - todo.length}, Remaining: ${todo.length}`)

  let inserted = 0
  let failed = 0
  for (let i = 0; i < todo.length; i++) {
    const { collectionId, bookId, chapter, expectedVerses, isFrontMatter, versesMissing } = todo[i]
    const label = `${collectionId}/${bookId}/${chapter}`

    try {
      const html = await fetchChapter(collectionId, bookId, chapter, isFrontMatter, language.apiCode)
      const verses = isFrontMatter ? parseParagraphs(html) : parseVerses(html)
      const heading = isFrontMatter ? null : parseChapterHeading(html)

      if (verses.length !== expectedVerses) {
        console.warn(`Warning: Expected ${expectedVerses} verses but parsed ${verses.length} for ${label}`)
      }

      // 節が揃っている章は見出しだけを足しに来ている。入れ直さない
      if (verses.length > 0 && versesMissing) {
        if (completedCounts.has(label)) {
          runPsql(`DELETE FROM scripture_verses WHERE collection_id='${sqlQuote(collectionId)}' AND book_id='${sqlQuote(bookId)}' AND chapter=${chapter} AND language='${sqlQuote(language.code)}';`)
        }
        insertVerses(collectionId, bookId, chapter, verses, language.code)
        inserted += verses.length
      }

      if (heading) {
        upsertHeading(collectionId, bookId, chapter, heading, language.code)
      } else if (!isFrontMatter) {
        console.warn(`Warning: No chapter heading parsed for ${label}`)
      }

      console.log(`[${i + 1}/${todo.length}] ${label} ... ${verses.length} verses`)
    } catch (err) {
      failed += 1
      console.error(`[${i + 1}/${todo.length}] ${label} FAILED: ${err.message}`)
    }

    if (i < todo.length - 1) await sleep(RATE_MS)
  }

  console.log(`\nDone: ${inserted} verses inserted`)

  // 章ごとの失敗は握って続けるが、そのまま成功で終わると不完全なまま
  // seed の書き出しや本番への投入へ進んでしまう
  if (failed > 0) {
    console.error(`${failed} chapter(s) failed. Re-run to retry them.`)
    process.exitCode = 1
  }
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
