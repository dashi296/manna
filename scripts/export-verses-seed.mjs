import { writeFileSync } from 'node:fs'
import { runPsql } from './lib/db.mjs'

const sql = `COPY (
  SELECT collection_id, book_id, chapter, verse, text, text_html
  FROM scripture_verses
  ORDER BY collection_id, book_id, chapter, verse
) TO STDOUT`

const data = runPsql(sql, { maxBuffer: 100 * 1024 * 1024 })

const rows = data.split('\n').filter(Boolean).length
const output = `-- scripture_verses seed data (${rows} rows)
-- Re-generate: node scripts/export-verses-seed.mjs
COPY scripture_verses (collection_id, book_id, chapter, verse, text, text_html) FROM STDIN;
${data}\\.
`

writeFileSync(new URL('../supabase/seed-verses.sql', import.meta.url), output)
console.log(`Generated supabase/seed-verses.sql (${rows} rows)`)
