# モルモン書 序文・証人の証 組み込み Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** モルモン書の前付け文書5つ（タイトルページ・序文・三人の証人の証・八人の証人の証・ジョセフ・スミスの証）を「1章・段落数ぶんの節を持つ擬似的な書」として既存の scripture_books / scripture_verses インフラに組み込み、フロントエンドで不自然な「第1章」表示が出ないようにする。

**Architecture:** `scripture_books.is_front_matter` フラグを追加し、既存の書/章/節テーブル構造をそのまま再利用する。前付け文書専用の段落パーサー `parseParagraphs()` を既存 `parseVerses()` と共通のHTMLクリーンアップ処理 (`cleanVerseHtml()`) を共有する形で新設し、フロントエンド6箇所で `book.isFrontMatter` を分岐条件として章ラベル表示を切り替える。

**Tech Stack:** Node.js (ESM scripts, `node:test`), PostgreSQL/Supabase migrations, TanStack Start (React/TypeScript), Vitest + Testing Library

## Global Constraints

- 対象5文書のid/名前/段落数は固定: `bofm-title`(4) / `introduction`(9) / `three`(4) / `eight`(9) / `js`(25) — 詳細設計 `docs/superpowers/specs/2026-07-23-bofm-front-matter-design.md` 参照
- マイグレーションファイルは `YYYYMMDDHHmmss_説明.sql` 形式・冪等（`IF NOT EXISTS` 等）で書く（`supabase/CLAUDE.md`）
- 章グリッドタップ遷移（`$collection/$book/index.tsx`）は変更しない（Out of Scope）
- 前付け文書専用の新規テーブルは作らない。既存 book/chapter/verse 構造を再利用する
- コメントは原則不要。WHY が自明でない場合のみ1行（`CLAUDE.md`）

---

### Task 1: マイグレーション追加 — `scripture_books.is_front_matter`

**Files:**
- Create: `supabase/migrations/20260723000001_scripture_books_front_matter.sql`

**Interfaces:**
- Produces: `scripture_books.is_front_matter boolean NOT NULL DEFAULT false` カラム（Task 5, Task 7-9 が消費）

- [x] **Step 1: マイグレーションファイルを作成する**

```sql
ALTER TABLE scripture_books
  ADD COLUMN IF NOT EXISTS is_front_matter boolean NOT NULL DEFAULT false;
```

- [x] **Step 2: ローカルDBにマイグレーションを適用して確認する**

Run: `bash scripts/db-reset.sh`
Expected: `Resetting database...` の後、マイグレーションが全て正常に適用され `Verse data imported.`（または `seed-verses.sql` 未取得なら警告のみ）で終了する

Run: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\d scripture_books"`
Expected: `is_front_matter` 列が `boolean not null default false` で表示される

- [x] **Step 3: コミット**

```bash
git add supabase/migrations/20260723000001_scripture_books_front_matter.sql
git commit -m "feat: add is_front_matter column to scripture_books"
```

---

### Task 2: `parseVerses()` から `cleanVerseHtml()` を切り出す

前付け文書パーサーと共有するため、HTMLクリーンアップ処理をリファクタで独立させる。振る舞いは変えないので、既存テストが通り続けることが確認基準。

**Files:**
- Modify: `scripts/lib/parse-verses.mjs`
- Test: `scripts/lib/parse-verses.test.mjs`（変更なし・回帰確認のみ）

**Interfaces:**
- Produces: `cleanVerseHtml(innerHtml: string): { text: string, textHtml: string }`（Task 3 が消費）
- Produces: `parseVerses(html: string): { verse: number, text: string, textHtml: string }[]`（変更前と同じシグネチャ・同じ挙動）

- [x] **Step 1: 既存テストが green であることを先に確認する**

Run: `node --test scripts/lib/parse-verses.test.mjs`
Expected: `tests 10`, `pass 10`, `fail 0`

- [x] **Step 2: `cleanVerseHtml()` を切り出してリファクタする**

`scripts/lib/parse-verses.mjs` を以下に置き換える:

```js
export function cleanVerseHtml(innerHtml) {
  // Remove sup.marker elements
  let cleaned = innerHtml.replace(/<sup class="marker"[^>]*>.*?<\/sup>/g, '')
  // Unwrap study-note-ref anchors (keep inner text)
  cleaned = cleaned.replace(/<a class="study-note-ref"[^>]*>(.*?)<\/a>/gs, '$1')
  // Remove any remaining non-ruby tags for textHtml
  const textHtml = cleaned
    .replace(/<(?!\/?ruby|\/?rb|\/?rt)[^>]+>/g, '')
    .trim()

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
```

- [x] **Step 3: リファクタ後も既存テストが green であることを確認する**

Run: `node --test scripts/lib/parse-verses.test.mjs`
Expected: `tests 10`, `pass 10`, `fail 0`（Step 1 と同じ結果 = 回帰なし）

- [x] **Step 4: コミット**

```bash
git add scripts/lib/parse-verses.mjs
git commit -m "refactor: extract cleanVerseHtml from parseVerses for reuse"
```

---

### Task 3: 前付け文書用パーサー `parseParagraphs()` を新設（TDD）

**Files:**
- Create: `scripts/lib/parse-paragraphs.mjs`
- Test: `scripts/lib/parse-paragraphs.test.mjs`

**Interfaces:**
- Consumes: `cleanVerseHtml(innerHtml: string): { text: string, textHtml: string }`（Task 2 で `scripts/lib/parse-verses.mjs` に定義済み）
- Produces: `parseParagraphs(html: string): { verse: number, text: string, textHtml: string }[]`（Task 6 が消費）

- [x] **Step 1: 失敗するテストを書く**

`scripts/lib/parse-paragraphs.test.mjs` を作成:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { parseParagraphs } from './parse-paragraphs.mjs'

const SAMPLE_HTML = `
<header><h1 data-aid="1" id="title1">序文</h1></header>
<p class="subtitle" data-aid="2" id="p1">わたしニーファイは<ruby><rb>善</rb><rt>よ</rt></ruby>い<ruby><rb>両</rb><rt>りょう</rt></ruby><ruby><rb>親</rb><rt>しん</rt></ruby>から<ruby><rb>生</rb><rt>う</rt></ruby>まれた。</p>
<p data-aid="3" id="p2">まことにわたしは<a class="study-note-ref" href="#note1_a"><sup class="marker" data-value="①"></sup>父</a>の<ruby><rb>言</rb><rt>こと</rt></ruby><ruby><rb>葉</rb><rt>ば</rt></ruby>で<ruby><rb>記</rb><rt>き</rt></ruby><ruby><rb>録</rb><rt>ろく</rt></ruby>する。</p>
<p class="signature" data-aid="4" id="p3">モルモンによって</p>
`

describe('parseParagraphs', () => {
  const paragraphs = parseParagraphs(SAMPLE_HTML)

  it('extracts every <p> paragraph regardless of class', () => {
    assert.strictEqual(paragraphs.length, 3)
  })

  it('assigns sequential verse numbers starting at 1', () => {
    assert.strictEqual(paragraphs[0].verse, 1)
    assert.strictEqual(paragraphs[1].verse, 2)
    assert.strictEqual(paragraphs[2].verse, 3)
  })

  it('produces plain text without HTML tags', () => {
    assert.strictEqual(paragraphs[0].text, 'わたしニーファイは善い両親から生まれた。')
    assert.strictEqual(paragraphs[2].text, 'モルモンによって')
  })

  it('preserves ruby tags in textHtml', () => {
    assert.ok(paragraphs[0].textHtml.includes('<ruby><rb>善</rb><rt>よ</rt></ruby>'))
  })

  it('removes study-note-ref tags but keeps inner text', () => {
    assert.ok(!paragraphs[1].textHtml.includes('study-note-ref'))
    assert.ok(paragraphs[1].textHtml.includes('父'))
  })

  it('removes sup.marker elements', () => {
    assert.ok(!paragraphs[1].textHtml.includes('marker'))
    assert.ok(!paragraphs[1].textHtml.includes('①'))
  })
})
```

- [x] **Step 2: テストを実行して失敗を確認する**

Run: `node --test scripts/lib/parse-paragraphs.test.mjs`
Expected: FAIL（`parse-paragraphs.mjs` が存在しないためモジュール解決エラー）

- [x] **Step 3: 最小実装を書く**

`scripts/lib/parse-paragraphs.mjs` を作成:

```js
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
```

- [x] **Step 4: テストを実行して通ることを確認する**

Run: `node --test scripts/lib/parse-paragraphs.test.mjs`
Expected: `tests 6`, `pass 6`, `fail 0`

- [x] **Step 5: コミット**

```bash
git add scripts/lib/parse-paragraphs.mjs scripts/lib/parse-paragraphs.test.mjs
git commit -m "feat: add parseParagraphs for front matter documents"
```

---

### Task 4: `scriptures.json` に5書を追加し、フロントエンドの節指定なしラベル/URLを front matter 対応にする（TDD）

**Files:**
- Modify: `apps/pwa/src/shared/config/scriptures.json:6-7`（`bofm.books` 配列の先頭）
- Modify: `apps/pwa/src/shared/lib/scriptureUtils.ts`
- Test: `apps/pwa/tests/entities/scripture/scriptureUtils.test.ts`

**Interfaces:**
- Consumes: なし（この書籍データ自体が起点）
- Produces: `scripturesData.collections[bofm].books` の先頭5件が `isFrontMatter: true` を持つ（Task 5〜9 が消費）
- Produces: `getScriptureLabel(ref)` / `buildScriptureUrl(ref)` が `book.isFrontMatter` を考慮する（既存シグネチャ・型 `ScriptureRef` は不変）

- [x] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/entities/scripture/scriptureUtils.test.ts` の `describe('buildScriptureUrl', ...)` ブロック末尾に追加:

```ts
  it('front matter の書は章番号セグメントを省いたURLを生成する（302リダイレクト回避）', () => {
    const url = buildScriptureUrl({ collection: 'bofm', book: 'introduction', chapter: 1 })
    expect(url).toBe('https://www.churchofjesuschrist.org/study/scriptures/bofm/introduction?lang=jpn')
  })
```

`describe('getScriptureLabel', ...)` ブロック末尾に追加:

```ts
  it('front matter の書は節指定なしでは書名のみを返す', () => {
    const label = getScriptureLabel({ collection: 'bofm', book: 'introduction', chapter: 1 })
    expect(label).toBe('序文')
  })

  it('front matter の書でも節指定があれば通常の 章:節 形式を返す', () => {
    const label = getScriptureLabel({ collection: 'bofm', book: 'introduction', chapter: 1, verses: [4] })
    expect(label).toBe('序文 1:4')
  })
```

- [x] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm --filter @manna/pwa test tests/entities/scripture/scriptureUtils.test.ts`
Expected: FAIL — `introduction` book が存在せず `bookName` が `ref.book`（`'introduction'`）にフォールバックするため期待値と不一致

- [x] **Step 3: `scriptures.json` の `bofm.books` 配列の先頭に5書を追加する**

`apps/pwa/src/shared/config/scriptures.json` の6行目 `"books": [` の直後（`{ "id": "1-ne", ...` の直前）に挿入:

```json
        { "id": "bofm-title", "name": "モルモン書のタイトルページ", "chapters": 1, "verses": [4], "isFrontMatter": true },
        { "id": "introduction", "name": "序文", "chapters": 1, "verses": [9], "isFrontMatter": true },
        { "id": "three", "name": "三人の証人の証", "chapters": 1, "verses": [4], "isFrontMatter": true },
        { "id": "eight", "name": "八人の証人の証", "chapters": 1, "verses": [9], "isFrontMatter": true },
        { "id": "js", "name": "預言者ジョセフ・スミスの証", "chapters": 1, "verses": [25], "isFrontMatter": true },
```

既存の書エントリ（`1-ne` 以降）はそのまま変更しない。

- [x] **Step 4: `getScriptureLabel` / `buildScriptureUrl` を front matter 対応にする**

`apps/pwa/src/shared/lib/scriptureUtils.ts` を以下に置き換える:

```ts
import scripturesData from '@/shared/config/scriptures.json'

export type ScriptureRef = {
  collection: string
  book: string
  chapter?: number
  verses?: number[]
}

function findBook(ref: ScriptureRef) {
  const collection = scripturesData.collections.find((c) => c.id === ref.collection)
  return collection?.books.find((b) => b.id === ref.book)
}

export function buildScriptureUrl(ref: ScriptureRef): string {
  const base = 'https://www.churchofjesuschrist.org/study/scriptures'
  const book = findBook(ref)
  const chapterSegment = book?.isFrontMatter ? '' : `/${ref.chapter}`
  let url = `${base}/${ref.collection}/${ref.book}${chapterSegment}?lang=jpn`
  const first = ref.verses ? [...ref.verses].sort((a, b) => a - b)[0] : undefined
  if (first) url += `&id=p${first}`
  return url
}

export function getScriptureLabel(ref: ScriptureRef): string {
  const book = findBook(ref)
  const bookName = book?.name ?? ref.book
  if (!ref.chapter) return bookName
  if (!ref.verses?.length) {
    return book?.isFrontMatter ? bookName : `${bookName} 第${ref.chapter}章`
  }
  const sorted = [...ref.verses].sort((a, b) => a - b)
  if (sorted.length === 1) return `${bookName} ${ref.chapter}:${sorted[0]}`
  const isConsecutive = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1)
  if (isConsecutive) return `${bookName} ${ref.chapter}:${sorted[0]}–${sorted[sorted.length - 1]}`
  return `${bookName} ${ref.chapter}:${sorted.join(', ')}`
}
```

- [x] **Step 5: テストを実行して通ることを確認する**

Run: `pnpm --filter @manna/pwa test tests/entities/scripture/scriptureUtils.test.ts`
Expected: 全テスト PASS（既存12件 + 新規3件）

- [x] **Step 6: コミット**

```bash
git add apps/pwa/src/shared/config/scriptures.json apps/pwa/src/shared/lib/scriptureUtils.ts apps/pwa/tests/entities/scripture/scriptureUtils.test.ts
git commit -m "feat: add BoM front matter books and front-matter-aware scripture labels/URLs"
```

---

### Task 5: `export-books-seed.mjs` を UPSERT 形式にし `is_front_matter` 列を書き出す

**Files:**
- Modify: `scripts/export-books-seed.mjs`

**Interfaces:**
- Consumes: `scripturesData.collections[].books[].isFrontMatter?: boolean`（Task 4 で `scriptures.json` に追加済み）、`scripture_books.is_front_matter` カラム（Task 1）
- Produces: `supabase/seed.sql`（book メタデータの UPSERT。Task 10 のローカル反映で使用）

- [x] **Step 1: `export-books-seed.mjs` を UPSERT 対応に書き換える**

`scripts/export-books-seed.mjs` を以下に置き換える:

```js
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
```

- [x] **Step 2: 生成し直して差分を目視確認する**

Run: `node scripts/export-books-seed.mjs`
Expected: `Generated supabase/seed.sql (5 collections, 92 books)`（前付け5書 + 既存87書。実装時に判明した訂正: プラン作成時点の見積もり「既存69書」は誤りで、正しくは87書）

Run: `git diff supabase/seed.sql | head -40`
Expected: 先頭5書（`bofm-title` / `introduction` / `three` / `eight` / `js`）の INSERT 行が追加され、末尾に `ON CONFLICT ... DO UPDATE` 句が両方の INSERT に付与されている

- [x] **Step 3: コミット**

```bash
git add scripts/export-books-seed.mjs supabase/seed.sql
git commit -m "feat: upsert scripture book metadata and record is_front_matter"
```

---

### Task 6: `fetch-scriptures.mjs` を front matter 対応にする

**Files:**
- Modify: `scripts/fetch-scriptures.mjs`

**Interfaces:**
- Consumes: `parseParagraphs(html): { verse, text, textHtml }[]`（Task 3）、`book.isFrontMatter?: boolean`（Task 4）
- Produces: `scripture_verses` テーブルへの前付け文書データ投入（Task 10 で実行）

- [x] **Step 1: `parseParagraphs` の import を追加し `buildChapterList()` に `isFrontMatter` を含める**

`scripts/fetch-scriptures.mjs:1-28` を以下に置き換える:

```js
import { readFileSync } from 'node:fs'
import { parseVerses } from './lib/parse-verses.mjs'
import { parseParagraphs } from './lib/parse-paragraphs.mjs'
import { runPsql } from './lib/db.mjs'

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
          expectedVerses: book.verses[ch - 1],
          isFrontMatter: book.isFrontMatter ?? false,
        })
      }
    }
  }
  return chapters
}
```

- [x] **Step 2: `fetchChapter()` に front matter 用の URI 分岐を追加する**

`scripts/fetch-scriptures.mjs:42-59`（`async function fetchChapter` 全体）を以下に置き換える:

```js
async function fetchChapter(collectionId, bookId, chapter, isFrontMatter) {
  const uri = isFrontMatter
    ? `/scriptures/${collectionId}/${bookId}`
    : `/scriptures/${collectionId}/${bookId}/${chapter}`
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
```

- [x] **Step 3: `main()` ループでパーサーを分岐する**

`scripts/fetch-scriptures.mjs` 内、`main()` のループ本体（`const { collectionId, bookId, chapter, expectedVerses } = todo[i]` を含むブロック）を以下に置き換える:

```js
    const { collectionId, bookId, chapter, expectedVerses, isFrontMatter } = todo[i]
    const label = `${collectionId}/${bookId}/${chapter}`

    try {
      const html = await fetchChapter(collectionId, bookId, chapter, isFrontMatter)
      const verses = isFrontMatter ? parseParagraphs(html) : parseVerses(html)

      if (verses.length !== expectedVerses) {
        console.warn(`Warning: Expected ${expectedVerses} verses but parsed ${verses.length} for ${label}`)
      }

      if (verses.length > 0) {
        if (completedCounts.has(label)) {
          runPsql(`DELETE FROM scripture_verses WHERE collection_id='${sqlQuote(collectionId)}' AND book_id='${sqlQuote(bookId)}' AND chapter=${chapter};`)
        }
        insertVerses(collectionId, bookId, chapter, verses)
        inserted += verses.length
      }

      console.log(`[${i + 1}/${todo.length}] ${label} ... ${verses.length} verses`)
    } catch (err) {
      console.error(`[${i + 1}/${todo.length}] ${label} FAILED: ${err.message}`)
    }
```

- [x] **Step 4: 変更後のファイル全体を読み、分岐漏れがないか確認する**

Run: `node --check scripts/fetch-scriptures.mjs`
Expected: 構文エラーなし（何も出力されない）

- [x] **Step 5: コミット**

```bash
git add scripts/fetch-scriptures.mjs
git commit -m "feat: fetch and parse BoM front matter documents"
```

---

### Task 7: `ChapterView` / `VerseView` の章ラベル表示を front matter 対応にする（TDD）

**Files:**
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx:269`（`VerseView` の `backLabel`）
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx:428`（`ChapterView` の `title`）
- Test: `apps/pwa/tests/pages/scriptures/chapter.test.tsx`

**Interfaces:**
- Consumes: `book.isFrontMatter?: boolean`（Task 4 の `scriptures.json` 変更により `Book` 型に自然に伝播する。`Book = NonNullable<ReturnType<typeof getBook>>`）

- [x] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/pages/scriptures/chapter.test.tsx` の `TestLoaderData` 型の `book` に `isFrontMatter?: boolean` を追加する:

```ts
type TestLoaderData = {
  book: {
    id: string
    name: string
    chapters: number
    verses: number[]
    isFrontMatter?: boolean
  }
  chapter: number
  collection: string
  mode: 'chapter' | 'verse'
  verses: number[]
  posts: PostWithUser[]
  verseTexts: { verse: number; text_html: string }[]
  userId: string | null
  chapterCommenters: { userId: string; name: string; avatarUrl: string | null }[]
  circlePosts: PostWithUser[]
}
```

`describe('ChapterPage', ...)` ブロックの末尾（最後の `it` の後、閉じ `})` の直前）に追加:

```ts
  it('front matter の章表示ではタイトルに「第◯章」を付けず書名のみ表示する', () => {
    loaderData = {
      ...baseChapterData,
      book: { id: 'introduction', name: '序文', chapters: 1, verses: [9], isFrontMatter: true },
    }
    render(<ChapterPage />)
    expect(screen.getByRole('heading', { name: '序文' })).toBeInTheDocument()
  })

  it('front matter の節表示では戻りリンクに「第◯章」を付けず書名のみ表示する', () => {
    loaderData = {
      ...baseChapterData,
      mode: 'verse',
      verses: [1],
      book: { id: 'introduction', name: '序文', chapters: 1, verses: [9], isFrontMatter: true },
    }
    render(<ChapterPage />)
    expect(screen.getByRole('link', { name: '序文' })).toBeInTheDocument()
  })
```

- [x] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm --filter @manna/pwa test tests/pages/scriptures/chapter.test.tsx`
Expected: 新規2件が FAIL（見出しが `序文 第1章`、戻りリンクの aria-label が `第1章` になっているため）

- [x] **Step 3: `VerseView` の `backLabel` を front matter 対応にする**

`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx:269` を変更:

```tsx
        backLabel={book.isFrontMatter ? book.name : `第${chapter}章`}
```

- [x] **Step 4: `ChapterView` の `title` を front matter 対応にする**

`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx:428` を変更:

```tsx
        title={book.isFrontMatter ? book.name : `${book.name} 第${chapter}章`}
```

- [x] **Step 5: テストを実行して通ることを確認する**

Run: `pnpm --filter @manna/pwa test tests/pages/scriptures/chapter.test.tsx`
Expected: 全テスト PASS（既存17件 + 新規2件）

- [x] **Step 6: コミット**

```bash
git add apps/pwa/src/pages/scriptures/\$collection/\$book/\$chapter.tsx apps/pwa/tests/pages/scriptures/chapter.test.tsx
git commit -m "feat: hide chapter number label for BoM front matter documents"
```

---

### Task 8: 書一覧ページの章数表示を front matter で省略する（TDD）

**Files:**
- Modify: `apps/pwa/src/pages/scriptures/$collection/index.tsx:30`
- Test: `apps/pwa/tests/pages/scriptures/collection.test.tsx`（新規）

**Interfaces:**
- Consumes: `book.isFrontMatter?: boolean`（Task 4）

- [x] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/pages/scriptures/collection.test.tsx` を作成:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { routeComponent } from '../../helpers/tanstack'

const loaderData = {
  id: 'bofm',
  name: 'モルモン書',
  books: [
    { id: 'introduction', name: '序文', chapters: 1, verses: [9], isFrontMatter: true },
    { id: '1-ne', name: '第1ニーファイ書', chapters: 22, verses: [20] },
  ],
}

vi.mock('@tanstack/react-router', async () =>
  (await import('../../helpers/tanstack')).routerMock(() => loaderData),
)

describe('CollectionPage', () => {
  it('front matter の書は章数を表示しない', async () => {
    const CollectionPage = routeComponent(await import('@/pages/scriptures/$collection/index'))
    render(<CollectionPage />)
    expect(screen.getByRole('link', { name: /序文/ })).toBeInTheDocument()
    expect(screen.queryByText(/1章/)).toBeNull()
  })

  it('通常の書は章数を表示する', async () => {
    const CollectionPage = routeComponent(await import('@/pages/scriptures/$collection/index'))
    render(<CollectionPage />)
    expect(screen.getByText('22章 ›')).toBeInTheDocument()
  })
})
```

- [x] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm --filter @manna/pwa test tests/pages/scriptures/collection.test.tsx`
Expected: 1件目が FAIL（現状は front matter でも `1章 ›` が表示されるため `/1章/` にマッチしてしまう）

- [x] **Step 3: 章数表示を front matter で条件分岐する**

`apps/pwa/src/pages/scriptures/$collection/index.tsx:30` を変更:

```tsx
                <span className="text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
                  {book.isFrontMatter ? '›' : `${book.chapters}章 ›`}
                </span>
```

- [x] **Step 4: テストを実行して通ることを確認する**

Run: `pnpm --filter @manna/pwa test tests/pages/scriptures/collection.test.tsx`
Expected: `tests 2 passed`

- [x] **Step 5: コミット**

```bash
git add apps/pwa/src/pages/scriptures/\$collection/index.tsx apps/pwa/tests/pages/scriptures/collection.test.tsx
git commit -m "feat: hide chapter count for BoM front matter documents in book list"
```

---

### Task 9: `ScriptureSelector` の章選択ラベルを front matter で省略する（TDD）

章番号ラベルの組み立てを `model.ts` の純粋関数として切り出し、Base UI の `Select` を実際に開閉するUIテストに頼らず軽量にテストする（このコンポーネントには Select を操作するテストの前例がなく、Base UI のポータル描画に依存する統合テストは避ける）。

**Files:**
- Modify: `apps/pwa/src/features/select-scripture/model.ts`
- Modify: `apps/pwa/src/features/select-scripture/index.ts`
- Modify: `apps/pwa/src/features/select-scripture/ui/ScriptureSelector.tsx:58-63`
- Test: `apps/pwa/tests/features/select-scripture/model.test.ts`（新規）

**Interfaces:**
- Consumes: `book.isFrontMatter?: boolean`（Task 4。`selectedBook` は `getBook()` 経由で取得される同じ `Book` 型）
- Produces: `buildChapterItems(book: { chapters: number; name: string; isFrontMatter?: boolean }): { value: string; label: string }[]`（`@/features/select-scripture` の公開APIとしてエクスポート）

- [x] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/features/select-scripture/model.test.ts` を作成:

```ts
import { describe, it, expect } from 'vitest'
import { buildChapterItems } from '@/features/select-scripture'

describe('buildChapterItems', () => {
  it('front matter の書は書名1件のみを返す', () => {
    const items = buildChapterItems({ chapters: 1, name: '序文', isFrontMatter: true })
    expect(items).toEqual([{ value: '1', label: '序文' }])
  })

  it('通常の書は章番号ラベルを章数ぶん返す', () => {
    const items = buildChapterItems({ chapters: 3, name: 'ヤコブ書' })
    expect(items).toEqual([
      { value: '1', label: '第1章' },
      { value: '2', label: '第2章' },
      { value: '3', label: '第3章' },
    ])
  })
})
```

- [x] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm --filter @manna/pwa test tests/features/select-scripture/model.test.ts`
Expected: FAIL（`buildChapterItems` が存在せずモジュール解決エラー）

- [x] **Step 3: `buildChapterItems` を `model.ts` に実装する**

`apps/pwa/src/features/select-scripture/model.ts` を以下に置き換える:

```ts
import type { ScriptureRef } from '@/entities/scripture'

export type ScriptureRefPartial = Partial<ScriptureRef>

type SelectableBook = { chapters: number; name: string; isFrontMatter?: boolean }

export function buildChapterItems(book: SelectableBook): { value: string; label: string }[] {
  if (book.isFrontMatter) return [{ value: '1', label: book.name }]
  return Array.from({ length: book.chapters }, (_, i) => ({
    value: (i + 1).toString(),
    label: `第${i + 1}章`,
  }))
}

export function parseVerses(input: string): number[] {
  const parsed = input
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0)
  return [...new Set(parsed)]
}
```

- [x] **Step 4: `index.ts` で公開APIとしてエクスポートする**

`apps/pwa/src/features/select-scripture/index.ts` を以下に置き換える:

```ts
export { ScriptureSelector } from './ui/ScriptureSelector'
export { parseVerses, buildChapterItems, type ScriptureRefPartial } from './model'
```

- [x] **Step 5: テストを実行して通ることを確認する**

Run: `pnpm --filter @manna/pwa test tests/features/select-scripture/model.test.ts`
Expected: `tests 2 passed`

- [x] **Step 6: `ScriptureSelector.tsx` で `buildChapterItems` を使うようにする**

`apps/pwa/src/features/select-scripture/ui/ScriptureSelector.tsx:12` の import を変更:

```tsx
import { parseVerses, buildChapterItems, type ScriptureRefPartial } from '../model'
```

`apps/pwa/src/features/select-scripture/ui/ScriptureSelector.tsx:58-63` を変更:

```tsx
  const chapterItems = selectedBook ? buildChapterItems(selectedBook) : []
```

- [x] **Step 7: pwa の全テストを実行し回帰がないことを確認する**

Run: `pnpm --filter @manna/pwa test`
Expected: 全テスト PASS（既存204件 + Task 8/9 の新規テスト）

- [x] **Step 8: コミット**

```bash
git add apps/pwa/src/features/select-scripture/model.ts apps/pwa/src/features/select-scripture/index.ts apps/pwa/src/features/select-scripture/ui/ScriptureSelector.tsx apps/pwa/tests/features/select-scripture/model.test.ts
git commit -m "feat: hide chapter number label for BoM front matter documents in composer selector"
```

---

### Task 10: ローカルDBへのデータ反映と冪等性確認（手動/運用ステップ）

Task 1〜9 のコード変更をローカル環境の実データに反映し、設計ドキュメントのテスト計画にある「seed.sql の2回適用で主キー競合が起きないこと」を確認する。ネットワークアクセスを伴うため対話的に実行する。

**Files:**
- 対象なし（コマンド実行のみ）

- [x] **Step 1: 型定義を再生成する**

Run: `pnpm supabase:types`
Expected: `packages/database/index.ts` の `scripture_books.Row/Insert/Update` に `is_front_matter: boolean` (Insert/Update は `is_front_matter?: boolean`) が追加される

- [x] **Step 2: `seed.sql` を先に適用し、書メタデータを冪等性込みで反映する**

**重要:** この Step は次の Step 3（節データ取得）より前に実行すること。`scripture_verses` には `scripture_books` への外部キー制約があるため、前付け5書の行が `scripture_books` に存在しない状態で `fetch-scriptures.mjs` を先に実行すると、節データの INSERT が外部キー違反で失敗する。しかし `scripts/lib/db.mjs` の `runPsql()` は `psql` の SQL エラーを検知せず素通りさせるため、`fetch-scriptures.mjs` 側は成功したように見えてしまう（コンソールに `... N verses` と出るが実際は 0 行しか入っていない）。2回適用するのは主キー競合が起きないこと（冪等性）の確認を兼ねる。

Run:
```bash
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql
```
Expected: 2回とも主キー競合エラーなく完了する（`ON_ERROR_STOP=1` によりエラー時は即座に非ゼロ終了する）

- [x] **Step 3: 前付け文書の節データを取得する**

Run: `node scripts/fetch-scriptures.mjs`
Expected: 出力の `Remaining:` に前付け5章分が含まれ、`bofm/bofm-title/1 ... 4 verses` のように前付け5書がそれぞれ期待段落数で完了する（`Warning: Expected N but parsed M` が出ないこと）

- [x] **Step 4: ローカル seed を更新する**

Run: `node scripts/export-verses-seed.mjs`
Expected: `Generated supabase/seed-verses.sql` の行数が前回より51行増える

- [x] **Step 5: 前付け文書のデータが揃っていることをDBで検証する**

Run:
```bash
psql "$DB_URL" -c "
SELECT
  COUNT(DISTINCT b.id) AS front_matter_books,
  COUNT(v.verse) AS front_matter_verses
FROM scripture_books AS b
LEFT JOIN scripture_verses AS v
  ON v.collection_id = b.collection_id
 AND v.book_id = b.id
WHERE b.collection_id = 'bofm'
  AND b.is_front_matter = true;
"
```
Expected: `front_matter_books = 5`, `front_matter_verses = 51`

- [x] **Step 6: フロントエンドが実データで正しく表示されることを確認する**

Run: `pnpm dev`（別ターミナル）
Browser: `http://localhost:3000/scriptures/bofm/introduction/1` を開く

Expected:
- ページ見出しが `📖 序文`（`第1章` が付かない）
- 「公式サイトで読む →」のリンク先が `https://www.churchofjesuschrist.org/study/scriptures/bofm/introduction?lang=jpn`
- `http://localhost:3000/scriptures/bofm` の書一覧で「序文」の行に章数（`1章`）が表示されない

- [x] **Step 7: 全テストスイートを実行する**

Run: `node --test scripts/lib/*.test.mjs && pnpm --filter @manna/pwa test`
Expected: 全て PASS

本番DBへのデータ投入は別途ユーザー判断で実施する（`docs/superpowers/specs/2026-07-23-bofm-front-matter-design.md` の「本番DBへのデータ投入」セクション参照）。このタスクでは行わない。

---

## Self-Review メモ

- 設計ドキュメントのスコープ（5書のid/名前/段落数、フロントエンド6箇所、`export-books-seed.mjs` の UPSERT 化、`fetch-scriptures.mjs` のURI分岐）は Task 1〜9 で全てカバーしている
- 設計ドキュメントのテスト計画は「既存テストがあれば追加」だったが、`CLAUDE.md` の「UIコンポーネントはTDDで実装」方針を優先し、既存テストのなかった Task 8（書一覧）・Task 9（`ScriptureSelector`）にも軽量なテストを追加する方針にプランを拡張した。Task 9 は Base UI の `Select` を開閉する統合テストの前例がないため、ラベル組み立てロジックを `model.ts` の純粋関数 `buildChapterItems` に切り出してユニットテストする形にした
- 「seed.sql の2回適用」「本番DBへの投入」はコード変更ではなく運用手順のため Task 10 に手動ステップとして分離した
