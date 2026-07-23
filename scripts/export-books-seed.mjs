import { readFileSync, writeFileSync } from 'node:fs'

const scriptures = JSON.parse(
  readFileSync(new URL('../apps/pwa/src/shared/config/scriptures.json', import.meta.url), 'utf8')
)

const q = (s) => s.replace(/'/g, "''")

const collections = scriptures.collections
  .map((c, i) => `  ('${q(c.id)}', '${q(c.name)}', ${i})`)
  .join(',\n')

const books = scriptures.collections
  .flatMap((c) =>
    c.books.map((b, i) =>
      `  ('${q(b.id)}', '${q(c.id)}', '${q(b.name)}', ${b.chapters}, '{${b.verses.join(',')}}', ${i}, ${b.isFrontMatter ? 'true' : 'false'})`
    )
  )
  .join(',\n')

const output = `-- Auto-generated from apps/pwa/src/shared/config/scriptures.json
-- Re-generate: node scripts/export-books-seed.mjs
-- Collections
INSERT INTO scripture_collections (id, name, sort_order) VALUES
${collections}
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name,
  sort_order = excluded.sort_order;

-- Books
INSERT INTO scripture_books (id, collection_id, name, chapters, verses, sort_order, is_front_matter) VALUES
${books}
ON CONFLICT (collection_id, id) DO UPDATE SET
  name = excluded.name,
  chapters = excluded.chapters,
  verses = excluded.verses,
  sort_order = excluded.sort_order,
  is_front_matter = excluded.is_front_matter;
`

writeFileSync(new URL('../supabase/seed.sql', import.meta.url), output)
console.log(`Generated supabase/seed.sql (${scriptures.collections.length} collections, ${scriptures.collections.reduce((n, c) => n + c.books.length, 0)} books)`)
