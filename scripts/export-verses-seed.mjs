import { writeFileSync } from 'node:fs'
import { runPsql } from './lib/db.mjs'

function dump(sql) {
  return runPsql(`COPY (${sql}) TO STDOUT`, { maxBuffer: 100 * 1024 * 1024 })
}

const verses = dump(`
  SELECT collection_id, book_id, chapter, verse, text, text_html, language
  FROM scripture_verses
  ORDER BY collection_id, book_id, chapter, verse, language
`)

// 章のタイトルと概要。節と同じく .gitignore なので、取り直さずに復元できるよう
// 同じ seed に入れる
const headings = dump(`
  SELECT collection_id, book_id, chapter, language, title, summary, summary_html
  FROM scripture_chapter_headings
  ORDER BY collection_id, book_id, chapter, language
`)

const countRows = (data) => data.split('\n').filter(Boolean).length
const verseRows = countRows(verses)
const headingRows = countRows(headings)

const output = `-- scripture seed data (verses: ${verseRows} rows, chapter headings: ${headingRows} rows)
-- Re-generate: node scripts/export-verses-seed.mjs
COPY scripture_verses (collection_id, book_id, chapter, verse, text, text_html, language) FROM STDIN;
${verses}\\.

COPY scripture_chapter_headings (collection_id, book_id, chapter, language, title, summary, summary_html) FROM STDIN;
${headings}\\.
`

writeFileSync(new URL('../supabase/seed-verses.sql', import.meta.url), output)
console.log(`Generated supabase/seed-verses.sql (verses: ${verseRows}, headings: ${headingRows})`)
