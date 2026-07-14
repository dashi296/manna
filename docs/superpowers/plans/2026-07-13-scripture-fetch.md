# 聖典テキスト取得スクリプト Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 教会公式サイトAPIから全聖典テキスト（日本語）を取得し、ローカルSupabaseの `scripture_verses` テーブルに保存する。

**Architecture:** `scriptures.json` のメタデータをもとに全1,582章のAPIリクエストを1req/秒で順次実行。HTMLレスポンスから節テキストを抽出し、プレーンテキスト(`text`)とルビ付きHTML(`text_html`)の2カラムに保存する。`psql` の `COPY` コマンドでバッチ挿入する。

**Tech Stack:** Node.js 24 (native fetch), PostgreSQL (psql), Supabase Local

## Global Constraints

- Node.js 24 — native fetch 使用、外部依存なし
- Supabase Local — `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- レート制限: 1リクエスト/秒（1,000ms 間隔）
- プロジェクトは ESM (`"type": "module"` in `apps/pwa/package.json`)。ルートの `package.json` には `type` 未設定だが、`.mjs` 拡張子で ESM を明示する

---

### Task 1: scripture_verses テーブルのマイグレーション

**Files:**
- Modify: `supabase/migrations/20260713000001_scripture_tables.sql`

**Interfaces:**
- Consumes: `scripture_books(collection_id, id)` FK ターゲット（既存）
- Produces: `scripture_verses(collection_id, book_id, chapter, verse, text, text_html)` テーブル

- [ ] **Step 1: マイグレーションファイルに scripture_verses テーブルを追加**

`supabase/migrations/20260713000001_scripture_tables.sql` の末尾に以下を追加:

```sql
CREATE TABLE IF NOT EXISTS scripture_verses (
  collection_id text NOT NULL,
  book_id text NOT NULL,
  chapter integer NOT NULL,
  verse integer NOT NULL,
  text text NOT NULL,
  text_html text NOT NULL,
  PRIMARY KEY (collection_id, book_id, chapter, verse),
  FOREIGN KEY (collection_id, book_id)
    REFERENCES scripture_books(collection_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS scripture_verses_text_gin
  ON scripture_verses USING GIN (to_tsvector('simple', text));

ALTER TABLE scripture_verses ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON scripture_verses TO anon, authenticated;

CREATE POLICY "scripture_verses_select_all"
  ON scripture_verses FOR SELECT
  TO anon, authenticated
  USING (true);
```

- [ ] **Step 2: DB をリセットしてマイグレーションを適用**

Run: `npx supabase db reset`

Expected: 全マイグレーションが成功し `scripture_verses` テーブルが作成される。

- [ ] **Step 3: テーブルの存在を確認**

Run: `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d scripture_verses"`

Expected: `collection_id`, `book_id`, `chapter`, `verse`, `text`, `text_html` カラムが表示される。

- [ ] **Step 4: seed データを再投入**

Run: `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/seed.sql`

Expected: `INSERT 0 5` と `INSERT 0 87` が出力される。

- [ ] **Step 5: コミット**

```bash
git add supabase/migrations/20260713000001_scripture_tables.sql
git commit -m "feat: scripture_versesテーブルをマイグレーションに追加"
```

---

### Task 2: HTML パースモジュール

**Files:**
- Create: `scripts/lib/parse-verses.mjs`
- Create: `scripts/lib/parse-verses.test.mjs`

**Interfaces:**
- Consumes: API レスポンスの `content.body` (HTML文字列)
- Produces: `parseVerses(html: string): Array<{verse: number, text: string, textHtml: string}>`

- [ ] **Step 1: テストファイルを作成**

`scripts/lib/parse-verses.test.mjs` を作成:

```js
import { describe, it, assert } from 'node:test'
import { parseVerses } from './parse-verses.mjs'

const SAMPLE_HTML = `
<header><h1 data-aid="1" id="title1">Title</h1></header>
<p class="study-summary" data-aid="2" id="study_summary1">Summary text</p>
<p class="verse" data-aid="3" id="p1"><span class="verse-number">1</span>わたし<a class="study-note-ref" href="#note1_a"><sup class="marker" data-value="①"></sup>ニーファイ</a>は<ruby><rb>善</rb><rt>よ</rt></ruby>い<ruby><rb>両</rb><rt>りょう</rt></ruby><ruby><rb>親</rb><rt>しん</rt></ruby>から<ruby><rb>生</rb><rt>う</rt></ruby>まれた。</p>
<p class="verse" data-aid="4" id="p2"><span class="verse-number">2</span>まことにわたしは<ruby><rb>父</rb><rt>ちち</rt></ruby>の<ruby><rb>言</rb><rt>こと</rt></ruby><ruby><rb>葉</rb><rt>ば</rt></ruby>で<ruby><rb>記</rb><rt>き</rt></ruby><ruby><rb>録</rb><rt>ろく</rt></ruby>する。</p>
`

describe('parseVerses', () => {
  const verses = parseVerses(SAMPLE_HTML)

  it('extracts correct number of verses', () => {
    assert.strictEqual(verses.length, 2)
  })

  it('extracts verse numbers', () => {
    assert.strictEqual(verses[0].verse, 1)
    assert.strictEqual(verses[1].verse, 2)
  })

  it('produces plain text without HTML tags', () => {
    assert.strictEqual(verses[0].text, 'わたしニーファイは善い両親から生まれた。')
  })

  it('preserves ruby tags in textHtml', () => {
    assert.ok(verses[0].textHtml.includes('<ruby><rb>善</rb><rt>よ</rt></ruby>'))
  })

  it('removes study-note-ref tags but keeps inner text', () => {
    assert.ok(!verses[0].textHtml.includes('study-note-ref'))
    assert.ok(verses[0].textHtml.includes('ニーファイ'))
  })

  it('removes sup.marker elements', () => {
    assert.ok(!verses[0].textHtml.includes('marker'))
    assert.ok(!verses[0].textHtml.includes('①'))
  })

  it('removes verse-number span', () => {
    assert.ok(!verses[0].textHtml.includes('verse-number'))
    assert.ok(!verses[0].text.startsWith('1'))
  })

  it('ignores non-verse paragraphs', () => {
    assert.ok(verses.every(v => v.verse > 0))
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test scripts/lib/parse-verses.test.mjs`

Expected: FAIL — `Cannot find module './parse-verses.mjs'`

- [ ] **Step 3: parseVerses を実装**

`scripts/lib/parse-verses.mjs` を作成:

```js
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

    // Plain text: strip all tags
    const text = cleaned.replace(/<[^>]+>/g, '').trim()

    verses.push({ verse: verseNum, text, textHtml })
  }

  return verses
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test scripts/lib/parse-verses.test.mjs`

Expected: 全8テスト PASS

- [ ] **Step 5: コミット**

```bash
git add scripts/lib/parse-verses.mjs scripts/lib/parse-verses.test.mjs
git commit -m "feat: 聖典HTMLパーサー parseVerses を追加"
```

---

### Task 3: 取得スクリプト本体

**Files:**
- Create: `scripts/fetch-scriptures.mjs`

**Interfaces:**
- Consumes: `parseVerses()` from `scripts/lib/parse-verses.mjs`
- Consumes: `apps/pwa/src/shared/config/scriptures.json` (メタデータ)
- Consumes: `scripture_verses` テーブル (Task 1)
- Produces: `scripture_verses` テーブルへの全データ INSERT

- [ ] **Step 1: スクリプトを作成**

`scripts/fetch-scriptures.mjs` を作成:

```js
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
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

function getCompletedChapters() {
  const result = execSync(
    `psql "${DB_URL}" -t -A -c "SELECT collection_id || '/' || book_id || '/' || chapter FROM scripture_verses GROUP BY collection_id, book_id, chapter"`,
    { encoding: 'utf8' }
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

function insertVerses(collectionId, bookId, chapter, verses) {
  const values = verses.map(v => {
    const esc = s => s.replace(/'/g, "''")
    return `('${esc(collectionId)}','${esc(bookId)}',${chapter},${v.verse},'${esc(v.text)}','${esc(v.textHtml)}')`
  })

  const sql = `INSERT INTO scripture_verses (collection_id, book_id, chapter, verse, text, text_html) VALUES ${values.join(',')};`
  execSync(`psql "${DB_URL}" -c "${sql.replace(/"/g, '\\"')}"`, { stdio: 'pipe' })
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
```

- [ ] **Step 2: 1章分だけテスト実行**

まず1章分だけ実行して動作を確認する。一時的にスクリプトを以下のコマンドで呼ぶ:

Run:
```bash
node -e "
import('./scripts/lib/parse-verses.mjs').then(async ({ parseVerses }) => {
  const res = await fetch('https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content?lang=jpn&uri=/scriptures/bofm/1-ne/1')
  const data = await res.json()
  const verses = parseVerses(data.content.body)
  console.log('Verses:', verses.length)
  console.log('First:', JSON.stringify(verses[0], null, 2))
  console.log('Last:', JSON.stringify(verses[verses.length - 1], null, 2))
})
"
```

Expected: `Verses: 20` と最初・最後の節データが表示される。

- [ ] **Step 3: スクリプト全体を少数章で動作確認**

Run:
```bash
node scripts/fetch-scriptures.mjs 2>&1 | head -10
```

Expected: 進捗ログが表示され、`scripture_verses` に節データが挿入される。Ctrl+C で中断可。

- [ ] **Step 4: 中断再開の動作確認**

Run:
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT COUNT(*) FROM scripture_verses"
node scripts/fetch-scriptures.mjs 2>&1 | head -5
```

Expected: `Skipping: N` が0より大きい値を示し、既に取得済みの章をスキップする。

- [ ] **Step 5: コミット**

```bash
git add scripts/fetch-scriptures.mjs
git commit -m "feat: 聖典テキスト取得スクリプト fetch-scriptures を追加"
```

---

### Task 4: 全聖典テキストの取得実行

**Files:** なし（スクリプト実行のみ）

**Interfaces:**
- Consumes: Task 1 (テーブル), Task 2 (パーサー), Task 3 (スクリプト)
- Produces: `scripture_verses` テーブルに全データ

- [ ] **Step 1: 全データ取得を実行**

Run: `node scripts/fetch-scriptures.mjs`

Expected: 約26分で全1,582章を取得。完了メッセージ `Done: NNNNN verses inserted`。

- [ ] **Step 2: データ確認**

Run:
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "
SELECT sc.name, COUNT(DISTINCT sv.book_id || '/' || sv.chapter) AS chapters, COUNT(*) AS verses
FROM scripture_verses sv
JOIN scripture_collections sc ON sc.id = sv.collection_id
GROUP BY sc.id, sc.name, sc.sort_order
ORDER BY sc.sort_order;
"
```

Expected: 5コレクション全ての章数と節数が表示される。

- [ ] **Step 3: サンプルデータ確認**

Run:
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "
SELECT verse, left(text, 60) AS text_preview, left(text_html, 80) AS html_preview
FROM scripture_verses
WHERE collection_id = 'bofm' AND book_id = '1-ne' AND chapter = 1
ORDER BY verse LIMIT 3;
"
```

Expected: 第1ニーファイ書1章の最初の3節がプレーンテキストとルビ付きHTMLの両方で表示される。
