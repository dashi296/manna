import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const DB_URL = process.env.DATABASE_URL
  || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const sql = `COPY (
  SELECT collection_id, book_id, chapter, verse, text, text_html
  FROM scripture_verses
  ORDER BY collection_id, book_id, chapter, verse
) TO STDOUT`

const data = execFileSync('psql', [DB_URL, '-t', '-A', '-c', sql], {
  encoding: 'utf8',
  maxBuffer: 100 * 1024 * 1024,
})

const rows = data.split('\n').filter(Boolean).length
const output = `-- scripture_verses seed data (${rows} rows)
-- Re-generate: node scripts/export-verses-seed.mjs
COPY scripture_verses (collection_id, book_id, chapter, verse, text, text_html) FROM STDIN;
${data}\\.
`

writeFileSync(new URL('../supabase/seed-verses.sql', import.meta.url), output)
console.log(`Generated supabase/seed-verses.sql (${rows} rows)`)
