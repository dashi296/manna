# 日英併記表示機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 聖典の章・節ページで、日本語テキストに加えて英語テキストを同時に表示できるトグル機能を追加する。

**Architecture:** `scripture_verses` に `language` 列を追加してPKを拡張し、教会公式APIから英語版の節データも取得できるようスクリプトを汎用化する（言語コードはレジストリ管理で将来の追加言語にも対応）。フロントエンドは `bilingual` URL検索パラメータでON/OFFを制御し、SSRローダーが必要な言語だけをクエリする。表示コンポーネント（`ScriptureText`/`VerseRow`）は「第2言語」という汎用propで英語テキストを受け取り、モバイルは縦並び、`lg`幅以上は左右2カラムにCSSブレークポイントだけで自動切替する。

**Tech Stack:** React 19 / TanStack Start / PostgreSQL (Supabase) / Node.js (ESM scripts, `node:test`) / Vitest + Testing Library

参照仕様書: [`docs/superpowers/specs/2026-07-24-bilingual-scripture-display-design.md`](../specs/2026-07-24-bilingual-scripture-display-design.md)

## Global Constraints

- 今回実装する言語は日本語(`ja`)＋英語(`en`)の2言語のみ。ただし言語コードは直書きせず、取得スクリプトはレジストリ（`scripts/lib/languages.mjs`）経由で解決する
- フロントエンドで「日本語と一緒に出す第2言語」は `apps/pwa/src/shared/config/scriptureLanguage.ts` の `SECONDARY_LANGUAGE` 定数1箇所にまとめる。コンポーネントのprop名は `textHtmlEn` のような言語決め打ちにせず `textHtmlSecondary`/`secondaryLang` とする
- `bilingual` ON/OFF状態はURL検索パラメータのみで保持する。DB・localStorageへの永続化はしない
- レイアウト切替はJS判定を使わず、Tailwindの `lg:` ブレークポイントのみで行う（モバイル: 縦並び、`lg`以上: 左右2カラム）
- FSD のインポート規則を守る: `features/toggle-bilingual` は `shared` のみに依存する
- コメントは WHY が自明でない場合のみ1行で記載（原則不要）
- マイグレーションは冪等に書く（`IF NOT EXISTS`/`IF EXISTS` を使う）
- テストコマンドは `cd apps/pwa && npx vitest run <path>`、スクリプト側は `node --test scripts/lib/<file>.test.mjs`

---

### Task 1: マイグレーション追加 — `scripture_verses.language`

**Files:**
- Create: `supabase/migrations/20260724000001_scripture_verses_language.sql`

**Interfaces:**
- Produces: `scripture_verses.language text NOT NULL DEFAULT 'ja'`、PK `(collection_id, book_id, chapter, verse, language)`（Task 3・Task 8 が消費）

- [ ] **Step 1: マイグレーションファイルを作成する**

```sql
ALTER TABLE scripture_verses ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'ja';

ALTER TABLE scripture_verses DROP CONSTRAINT IF EXISTS scripture_verses_pkey;
ALTER TABLE scripture_verses ADD CONSTRAINT scripture_verses_pkey
  PRIMARY KEY (collection_id, book_id, chapter, verse, language);
```

- [ ] **Step 2: ローカルDBにマイグレーションを適用して確認する**

Run: `bash scripts/db-reset.sh`
Expected: マイグレーションが全て正常に適用され、`Verse data imported.`（または `seed-verses.sql` 未取得時は警告のみ）で終了する

Run: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\d scripture_verses"`
Expected: `language` 列が `text not null default 'ja'::text` で表示され、`scripture_verses_pkey` が `(collection_id, book_id, chapter, verse, language)` になっている

- [ ] **Step 3: コミット**

```bash
git add supabase/migrations/20260724000001_scripture_verses_language.sql
git commit -m "feat: add language column to scripture_verses and extend primary key"
```

---

### Task 2: 言語コードレジストリ `scripts/lib/languages.mjs`（TDD）

**Files:**
- Create: `scripts/lib/languages.mjs`
- Test: `scripts/lib/languages.test.mjs`

**Interfaces:**
- Produces: `LANGUAGES: Record<string, { apiCode: string; label: string }>`、`resolveLanguage(code: string): { code: string; apiCode: string; label: string }`（Task 3 が消費）

- [ ] **Step 1: 失敗するテストを書く**

Create `scripts/lib/languages.test.mjs`:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { resolveLanguage } from './languages.mjs'

describe('resolveLanguage', () => {
  it('ja を教会公式APIの言語コード jpn に解決する', () => {
    assert.deepStrictEqual(resolveLanguage('ja'), { code: 'ja', apiCode: 'jpn', label: '日本語' })
  })

  it('en を教会公式APIの言語コード eng に解決する', () => {
    assert.deepStrictEqual(resolveLanguage('en'), { code: 'en', apiCode: 'eng', label: 'English' })
  })

  it('未登録の言語コードはエラーを投げる', () => {
    assert.throws(() => resolveLanguage('fr'), /Unknown language code: fr/)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `node --test scripts/lib/languages.test.mjs`
Expected: `Cannot find module './languages.mjs'` で FAIL

- [ ] **Step 3: 実装する**

Create `scripts/lib/languages.mjs`:

```js
export const LANGUAGES = {
  ja: { apiCode: 'jpn', label: '日本語' },
  en: { apiCode: 'eng', label: 'English' },
}

export function resolveLanguage(code) {
  const entry = LANGUAGES[code]
  if (!entry) {
    throw new Error(`Unknown language code: ${code}. Add it to LANGUAGES in scripts/lib/languages.mjs first.`)
  }
  return { code, ...entry }
}
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `node --test scripts/lib/languages.test.mjs`
Expected: `tests 3`, `pass 3`, `fail 0`

- [ ] **Step 5: コミット**

```bash
git add scripts/lib/languages.mjs scripts/lib/languages.test.mjs
git commit -m "feat: add language code registry for scripture fetch scripts"
```

---

### Task 3: `fetch-scriptures.mjs` を多言語対応にする

**Files:**
- Modify: `scripts/fetch-scriptures.mjs`

**Interfaces:**
- Consumes: `resolveLanguage(code): { code, apiCode, label }`（Task 2）
- Produces: `--lang=<code>` CLIフラグ付きで `scripture_verses` に指定言語のデータを投入する動作（Task 9 の運用ステップが実行）

- [ ] **Step 1: ファイル全体を新しい内容に置き換える**

`scripts/fetch-scriptures.mjs` を以下に置き換える:

```js
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
```

**注意（既存バグの修正）:** 変更前の `DELETE FROM scripture_verses WHERE collection_id=... AND book_id=... AND chapter=...` は `language` 条件がなく、章の再取得時に別言語の行まで消してしまう。上記では `AND language='...'` を追加して該当言語の行だけを消すようにしている。

- [ ] **Step 2: 構文エラーがないか確認する**

Run: `node --check scripts/fetch-scriptures.mjs`
Expected: 何も出力されない（構文エラーなし）

- [ ] **Step 3: 既存の関連テストが green であることを確認する**

Run: `node --test scripts/lib/parse-verses.test.mjs scripts/lib/parse-paragraphs.test.mjs scripts/lib/languages.test.mjs`
Expected: 全て PASS（`fetch-scriptures.mjs` は間接的にこれらを使うのみで直接のテストファイルは無いため回帰確認）

- [ ] **Step 4: コミット**

```bash
git add scripts/fetch-scriptures.mjs
git commit -m "feat: support fetching scripture verses in multiple languages"
```

---

### Task 4: `export-verses-seed.mjs` を `language` 対応にする

**Files:**
- Modify: `scripts/export-verses-seed.mjs`

**Interfaces:**
- Produces: `supabase/seed-verses.sql`（`language` 列を含む形式、Task 9 が生成・使用）

- [ ] **Step 1: ファイル全体を新しい内容に置き換える**

`scripts/export-verses-seed.mjs` を以下に置き換える:

```js
import { writeFileSync } from 'node:fs'
import { runPsql } from './lib/db.mjs'

const sql = `COPY (
  SELECT collection_id, book_id, chapter, verse, text, text_html, language
  FROM scripture_verses
  ORDER BY collection_id, book_id, chapter, verse, language
) TO STDOUT`

const data = runPsql(sql, { maxBuffer: 100 * 1024 * 1024 })

const rows = data.split('\n').filter(Boolean).length
const output = `-- scripture_verses seed data (${rows} rows)
-- Re-generate: node scripts/export-verses-seed.mjs
COPY scripture_verses (collection_id, book_id, chapter, verse, text, text_html, language) FROM STDIN;
${data}\\.
`

writeFileSync(new URL('../supabase/seed-verses.sql', import.meta.url), output)
console.log(`Generated supabase/seed-verses.sql (${rows} rows)`)
```

- [ ] **Step 2: 構文エラーがないか確認する**

Run: `node --check scripts/export-verses-seed.mjs`
Expected: 何も出力されない

- [ ] **Step 3: コミット**

```bash
git add scripts/export-verses-seed.mjs
git commit -m "feat: include language column when exporting verses seed"
```

---

### Task 5: `ScriptureText` に第2言語表示を追加する（TDD）

**Files:**
- Modify: `apps/pwa/src/shared/ui/ScriptureText.tsx`
- Test: `apps/pwa/tests/shared/ui/ScriptureText.test.tsx`

**Interfaces:**
- Produces: `ScriptureText` の新規props `textHtmlSecondary?: string`、`secondaryLang?: string`。`SanitizedVerseHtml` の新規prop `lang?: string`（Task 8 が消費）

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/shared/ui/ScriptureText.test.tsx` の末尾（最後の `it` の後、`})` の直前）に追加:

```tsx
  it('textHtmlSecondary 指定時は第2言語のテキストも lang 属性付きで表示する', () => {
    const { container } = render(
      <ScriptureText
        verse={1}
        textHtml="日本語のテキスト"
        textHtmlSecondary="English text"
        secondaryLang="en"
      />
    )
    expect(screen.getByText('日本語のテキスト')).toBeInTheDocument()
    expect(screen.getByText('English text')).toBeInTheDocument()
    const secondary = container.querySelector('[lang="en"]')
    expect(secondary).not.toBeNull()
    expect(secondary?.textContent).toBe('English text')
  })

  it('textHtmlSecondary が無ければ第2言語ブロックを描画しない', () => {
    const { container } = render(<ScriptureText verse={1} textHtml="日本語のテキスト" />)
    expect(container.querySelector('[lang]')).toBeNull()
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `cd apps/pwa && npx vitest run tests/shared/ui/ScriptureText.test.tsx`
Expected: 新規2件が FAIL（`textHtmlSecondary`/`secondaryLang` propが存在せず `English text` が描画されない）

- [ ] **Step 3: 実装する**

`apps/pwa/src/shared/ui/ScriptureText.tsx` を以下に置き換える:

```tsx
import { useEffect, useRef, type CSSProperties } from 'react'
import DOMPurify from 'dompurify'
import { cn } from '@/shared/lib/utils'

const PURIFY_CONFIG = {
  ALLOWED_TAGS: ['ruby', 'rb', 'rt'],
  ALLOWED_ATTR: [],
}

// DOMPurify needs a real DOM `window` to sanitize against. This app's SSR/edge
// runtime (Cloudflare Workers via TanStack Start) has no DOM at all, so
// `sanitizeVerseHtml` must only ever run in the browser — e.g. from a
// `useEffect` after mount, never during a server render.
function sanitizeVerseHtml(textHtml: string): string {
  return DOMPurify.sanitize(textHtml, PURIFY_CONFIG)
}

type SanitizedVerseHtmlProps = {
  html: string
  className?: string
  style?: CSSProperties
  lang?: string
}

// Renders sanitized `text_html` by injecting it imperatively after mount
// (client-only), instead of `dangerouslySetInnerHTML`, so the raw HTML is
// never touched during SSR — avoiding both a server crash (no DOM to
// sanitize against) and ever serving unsanitized markup.
export function SanitizedVerseHtml({ html, className, style, lang }: SanitizedVerseHtmlProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = sanitizeVerseHtml(html)
    }
  }, [html])

  return <span ref={ref} className={className} style={style} lang={lang} />
}

type Props = {
  verse: number
  textHtml: string
  textHtmlSecondary?: string
  secondaryLang?: string
  className?: string
  showNumber?: boolean
}

export function ScriptureText({
  verse,
  textHtml,
  textHtmlSecondary,
  secondaryLang,
  className,
  showNumber = true,
}: Props) {
  return (
    <div className={cn('flex gap-2 py-2 text-sm leading-relaxed', className)}>
      {showNumber && (
        <span
          className="shrink-0 w-6 text-right text-xs font-medium pt-0.5"
          style={{ color: 'var(--sea-ink-soft)' }}
        >
          {verse}
        </span>
      )}
      <div className={cn('flex-1 min-w-0', textHtmlSecondary && 'flex flex-col gap-1 lg:flex-row lg:gap-4')}>
        <SanitizedVerseHtml
          html={textHtml}
          className={textHtmlSecondary ? 'lg:flex-1' : undefined}
          style={{ color: 'var(--sea-ink)' }}
        />
        {textHtmlSecondary && (
          <SanitizedVerseHtml
            html={textHtmlSecondary}
            className="lg:flex-1"
            style={{ color: 'var(--sea-ink-soft)' }}
            lang={secondaryLang}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `cd apps/pwa && npx vitest run tests/shared/ui/ScriptureText.test.tsx`
Expected: PASS（既存4件 + 新規2件）

- [ ] **Step 5: コミット**

```bash
git add apps/pwa/src/shared/ui/ScriptureText.tsx apps/pwa/tests/shared/ui/ScriptureText.test.tsx
git commit -m "feat: support secondary-language verse text in ScriptureText"
```

---

### Task 6: `VerseRow` に第2言語表示とURLパラメータ引き継ぎを追加する（TDD）

**Files:**
- Modify: `apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx`
- Test: `apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx`

**Interfaces:**
- Consumes: `SanitizedVerseHtml` の `lang?: string` prop（Task 5）
- Produces: `VerseRow` の新規props `textHtmlSecondary?: string`、`secondaryLang?: string`（Task 8 が消費）

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx` の末尾（最後の `describe` ブロックの後）に追加:

```tsx
describe('VerseRow bilingual', () => {
  it('textHtmlSecondary 指定時は lang 属性付きで第2言語テキストを表示する', async () => {
    const { container } = renderInRouter(
      <VerseRow
        {...baseProps}
        mode="read"
        selected={false}
        onSelect={vi.fn()}
        textHtmlSecondary="Home to the Lord is one way"
        secondaryLang="en"
      />,
    )
    await waitFor(() => {
      expect(screen.getByText('Home to the Lord is one way')).toBeInTheDocument()
    })
    expect(container.querySelector('[lang="en"]')).not.toBeNull()
  })

  it('textHtmlSecondary が無ければ第2言語ブロックを描画しない', async () => {
    const { container } = renderInRouter(
      <VerseRow {...baseProps} mode="read" selected={false} onSelect={vi.fn()} />,
    )
    await waitFor(() => {
      expect(screen.getByText('19')).toBeInTheDocument()
    })
    expect(container.querySelector('[lang]')).toBeNull()
  })

  it('mode="read" のリンクは既存の検索パラメータ（bilingual等）を引き継ぐ', async () => {
    const rootRoute = createRootRoute({
      component: () => <Outlet />,
      notFoundComponent: () => <div>404</div>,
    })
    const chapterRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/scriptures/$collection/$book/$chapter',
      validateSearch: (search: Record<string, unknown>) => ({
        bilingual: search.bilingual === true ? true : undefined,
      }),
      component: () => (
        <VerseRow {...baseProps} mode="read" selected={false} onSelect={vi.fn()} />
      ),
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([chapterRoute]),
      history: createMemoryHistory({
        initialEntries: ['/scriptures/bofm/mosiah/3?bilingual=true'],
      }),
    })
    render(<RouterProvider router={router} />)
    await waitFor(() => {
      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        expect.stringContaining('bilingual'),
      )
    })
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `cd apps/pwa && npx vitest run tests/features/select-scripture-verses/VerseRow.test.tsx`
Expected: 新規3件が FAIL（`textHtmlSecondary`/`secondaryLang` prop未対応、リンクの `search` が静的オブジェクトのため `bilingual` が引き継がれない）

- [ ] **Step 3: 実装する**

`apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx` を以下に置き換える:

```tsx
import type { CSSProperties } from 'react'
import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { SanitizedVerseHtml, UserAvatar } from '@/shared/ui'
import type { AvatarStackItem } from '@/shared/ui'
import { cn } from '@/shared/lib/utils'

const ROW_TRANSITION = 'background-color 200ms, border-color 200ms'
const ROW_SELECTED_STYLE: CSSProperties = {
  background: 'var(--chip-bg)',
  borderLeft: '3px solid var(--lagoon)',
  transition: ROW_TRANSITION,
}
const ROW_UNSELECTED_STYLE: CSSProperties = {
  background: 'transparent',
  borderLeft: '3px solid transparent',
  transition: ROW_TRANSITION,
}

type Props = {
  collection: string
  book: string
  chapter: number
  verse: number
  textHtml?: string
  textHtmlSecondary?: string
  secondaryLang?: string
  mode: 'read' | 'select'
  selected: boolean
  onSelect: (verse: number) => void
  commenterMarker?: AvatarStackItem
  onMarkerClick?: (verse: number) => void
  showNumber?: boolean
}

export function VerseRow({
  collection,
  book,
  chapter,
  verse,
  textHtml,
  textHtmlSecondary,
  secondaryLang,
  mode,
  selected,
  onSelect,
  commenterMarker,
  onMarkerClick,
  showNumber = true,
}: Props) {
  const containerStyle = selected ? ROW_SELECTED_STYLE : ROW_UNSELECTED_STYLE

  const inner = (
    <div className="flex items-start gap-2 px-4 py-3">
      {mode === 'select' && (
        <div
          aria-hidden="true"
          className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors"
          style={{
            border: `1.5px solid ${selected ? 'var(--lagoon)' : 'var(--line)'}`,
            background: selected ? 'var(--lagoon)' : 'transparent',
          }}
        >
          {selected && (
            <Check size={12} strokeWidth={3} color="#fff" aria-hidden="true" />
          )}
        </div>
      )}
      <div
        className="flex-1 min-w-0 flex items-start justify-between gap-2"
        style={{ color: 'var(--sea-ink)' }}
      >
        <div className="flex-1 min-w-0">
          {showNumber && (
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--sea-ink-soft)' }}
            >
              {verse}
            </span>
          )}
          {textHtml && (
            <div className={textHtmlSecondary ? 'flex flex-col gap-1 lg:flex-row lg:gap-4' : undefined}>
              <SanitizedVerseHtml
                html={textHtml}
                className={cn(showNumber ? 'ml-2 text-sm' : 'text-sm', textHtmlSecondary && 'lg:flex-1')}
                style={{ color: 'var(--sea-ink)' }}
              />
              {textHtmlSecondary && (
                <SanitizedVerseHtml
                  html={textHtmlSecondary}
                  className={cn('text-sm lg:flex-1', showNumber && 'ml-2 lg:ml-0')}
                  style={{ color: 'var(--sea-ink-soft)' }}
                  lang={secondaryLang}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (mode === 'select') {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={`${verse}節を選択`}
        onClick={() => onSelect(verse)}
        className="w-full text-left"
        style={containerStyle}
      >
        {inner}
      </button>
    )
  }

  return (
    <div className="relative" style={containerStyle}>
      <Link
        to="/scriptures/$collection/$book/$chapter"
        params={{ collection, book, chapter: String(chapter) }}
        search={(prev) => ({ ...prev, verses: [verse] })}
        className="block"
      >
        {inner}
      </Link>
      {commenterMarker && (
        <button
          type="button"
          aria-label={`${commenterMarker.name} の ${verse}節 コメントを見る`}
          onClick={() => onMarkerClick?.(verse)}
          className="absolute z-10 rounded-full"
          style={{ top: 12, right: -4 }}
        >
          <UserAvatar
            name={commenterMarker.name}
            url={commenterMarker.avatarUrl}
            size="xs"
          />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `cd apps/pwa && npx vitest run tests/features/select-scripture-verses/VerseRow.test.tsx`
Expected: PASS（既存8件 + 新規3件）

- [ ] **Step 5: コミット**

```bash
git add apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx
git commit -m "feat: support secondary-language verse text and search param carry-over in VerseRow"
```

---

### Task 7: `features/toggle-bilingual` — 日英併記トグルボタン（TDD）

**Files:**
- Create: `apps/pwa/src/features/toggle-bilingual/ui/BilingualToggleButton.tsx`
- Create: `apps/pwa/src/features/toggle-bilingual/index.ts`
- Test: `apps/pwa/tests/features/toggle-bilingual/BilingualToggleButton.test.tsx`

**Interfaces:**
- Consumes: `Button`（`@/shared/ui/button`、既存の `variant`/`size` props）
- Produces: `BilingualToggleButton({ active: boolean; onToggle: () => void }): JSX.Element`（`@/features/toggle-bilingual`、Task 8 が消費）

- [ ] **Step 1: 失敗するテストを書く**

Create `apps/pwa/tests/features/toggle-bilingual/BilingualToggleButton.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BilingualToggleButton } from '@/features/toggle-bilingual'

describe('BilingualToggleButton', () => {
  it('active=false のとき「オンにする」ラベルで aria-pressed=false', () => {
    render(<BilingualToggleButton active={false} onToggle={vi.fn()} />)
    const btn = screen.getByRole('button', { name: '日英併記表示をオンにする' })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('active=true のとき「オフにする」ラベルで aria-pressed=true', () => {
    render(<BilingualToggleButton active={true} onToggle={vi.fn()} />)
    const btn = screen.getByRole('button', { name: '日英併記表示をオフにする' })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('クリックで onToggle が呼ばれる', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<BilingualToggleButton active={false} onToggle={onToggle} />)
    await user.click(screen.getByRole('button', { name: '日英併記表示をオンにする' }))
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `cd apps/pwa && npx vitest run tests/features/toggle-bilingual/BilingualToggleButton.test.tsx`
Expected: FAIL — `Cannot find module '@/features/toggle-bilingual'`

- [ ] **Step 3: 実装する**

Create `apps/pwa/src/features/toggle-bilingual/ui/BilingualToggleButton.tsx`:

```tsx
import { Languages } from 'lucide-react'
import { Button } from '@/shared/ui/button'

type Props = {
  active: boolean
  onToggle: () => void
}

export function BilingualToggleButton({ active, onToggle }: Props) {
  return (
    <Button
      type="button"
      variant={active ? 'accent' : 'ghost'}
      size="icon-sm"
      onClick={onToggle}
      aria-label={active ? '日英併記表示をオフにする' : '日英併記表示をオンにする'}
      aria-pressed={active}
    >
      <Languages aria-hidden="true" />
    </Button>
  )
}
```

Create `apps/pwa/src/features/toggle-bilingual/index.ts`:

```ts
export { BilingualToggleButton } from './ui/BilingualToggleButton'
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `cd apps/pwa && npx vitest run tests/features/toggle-bilingual/BilingualToggleButton.test.tsx`
Expected: PASS（3 tests）

- [ ] **Step 5: コミット**

```bash
git add apps/pwa/src/features/toggle-bilingual apps/pwa/tests/features/toggle-bilingual
git commit -m "feat: add bilingual display toggle button"
```

---

### Task 8: 章ページへの統合（クエリ・ローダー・UI）（TDD）

**Files:**
- Create: `apps/pwa/src/shared/config/scriptureLanguage.ts`
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx`
- Test: `apps/pwa/tests/pages/scriptures/chapter.test.tsx`

**Interfaces:**
- Consumes: `ScriptureText`/`textHtmlSecondary`/`secondaryLang`（Task 5）、`VerseRow`/`textHtmlSecondary`/`secondaryLang`（Task 6）、`BilingualToggleButton`（Task 7、`@/features/toggle-bilingual`）
- Produces: `SECONDARY_LANGUAGE: string`（`@/shared/config/scriptureLanguage`）、`ChapterSearch.bilingual?: boolean`

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/pages/scriptures/chapter.test.tsx` の `TestLoaderData` 型（7-24行目）を以下に置き換える:

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
  verseTexts: { verse: number; language: string; text_html: string }[]
  userId: string | null
  chapterCommenters: { userId: string; name: string; avatarUrl: string | null }[]
  circlePosts: PostWithUser[]
}
```

`baseChapterData`（26-45行目）を以下に置き換える:

```ts
const baseChapterData: TestLoaderData = {
  book: {
    id: '1-ne',
    name: '第1ニーファイ書',
    chapters: 22,
    verses: [20],
  },
  chapter: 1,
  collection: 'bofm',
  mode: 'chapter' as const,
  verses: [],
  posts: [],
  verseTexts: [
    { verse: 1, language: 'ja', text_html: '一節の本文' },
    { verse: 2, language: 'ja', text_html: '二節の本文' },
  ],
  userId: 'user-1',
  chapterCommenters: [],
  circlePosts: [],
}
```

`search` 変数の宣言（48行目）を以下に置き換える:

```ts
let search: { select?: number[]; mode?: 'select'; bilingual?: boolean } = { select: [1, 2] }
```

`describe('ChapterPage', ...)` ブロックの末尾（最後の `it` の後、閉じ `})` の直前）に追加:

```tsx
  it('日英併記ボタンをクリックすると bilingual=true で navigate される', async () => {
    search = {}
    const user = userEvent.setup()
    render(<ChapterPage />)
    await user.click(screen.getByRole('button', { name: '日英併記表示をオンにする' }))
    expect(navigateSpy).toHaveBeenCalled()
    const lastCall = navigateSpy.mock.calls.at(-1)?.[0]
    const result = lastCall.search({})
    expect(result.bilingual).toBe(true)
  })

  it('bilingual=true のとき第2言語の節本文も表示する', () => {
    search = { bilingual: true }
    loaderData = {
      ...baseChapterData,
      verseTexts: [
        { verse: 1, language: 'ja', text_html: '一節の日本語' },
        { verse: 1, language: 'en', text_html: 'Verse one in English' },
      ],
    }
    render(<ChapterPage />)
    expect(screen.getByText('一節の日本語')).toBeInTheDocument()
    expect(screen.getByText('Verse one in English')).toBeInTheDocument()
  })

  it('bilingual=false のとき第2言語の節本文は表示しない', () => {
    search = {}
    loaderData = {
      ...baseChapterData,
      verseTexts: [{ verse: 1, language: 'ja', text_html: '一節の日本語' }],
    }
    render(<ChapterPage />)
    expect(screen.getByText('一節の日本語')).toBeInTheDocument()
    expect(screen.queryByText('Verse one in English')).toBeNull()
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `cd apps/pwa && npx vitest run tests/pages/scriptures/chapter.test.tsx`
Expected: 新規3件が FAIL（「日英併記表示をオンにする」ボタンが存在せず、`verseTexts` に同一 `verse` の複数言語行があっても片方しか表示されない）

- [ ] **Step 3: `SECONDARY_LANGUAGE` 定数を作成する**

Create `apps/pwa/src/shared/config/scriptureLanguage.ts`:

```ts
export const SECONDARY_LANGUAGE = 'en'
```

- [ ] **Step 4: import・型・クエリ関数を更新する**

`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` の先頭 import ブロック（1-28行目）を以下に置き換える:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getBook, getCollection, buildScriptureUrl, getScriptureLabel } from '@/entities/scripture'
import { PostCard, POST_SELECT, CommenterBubble, type PostWithUser } from '@/entities/post'
import { createSupabaseServer } from '@/shared/lib/auth'
import { EmptyState, PageHeader, ScriptureText } from '@/shared/ui'
import { Button } from '@/shared/ui/button'
import { PostComposerSheet } from '@/widgets/post-composer-sheet'
import { ComposeMenu } from '@/widgets/compose-menu'
import {
  SelectionModeHeader,
  VerseRow,
  parseSelection,
  toggleVerse,
  type SelectionMode,
} from '@/features/select-scripture-verses'
import {
  ChapterCommentersRow,
  useSelectedUserId,
  useSelectedUserStore,
} from '@/features/select-verse-view'
import { VerseCommentSheet } from '@/widgets/verse-comment-sheet'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { getCircleUserIds } from '@/entities/user'
import type { AvatarStackItem } from '@/shared/ui'
import { useBookmarkStore } from '@/entities/bookmark'
import { BookmarkButton } from '@/features/toggle-bookmark'
import { BilingualToggleButton } from '@/features/toggle-bilingual'
import { SECONDARY_LANGUAGE } from '@/shared/config/scriptureLanguage'
```

続く型定義・クエリ関数ブロック（`type VerseText = ...` から `queryVerseTexts` 関数の終わりまで、変更前の30-62行目）を以下に置き換える:

```ts
type VerseText = { verse: number; language: string; text_html: string }
type VerseTextPair = { ja: string; secondary?: string }
type Book = NonNullable<ReturnType<typeof getBook>>
type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServer>>
type ChapterRef = { collection: string; book: string; chapter: number }

async function queryCurrentUserId(supabase: SupabaseServer) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

async function queryUserAndCircle(supabase: SupabaseServer) {
  const userId = await queryCurrentUserId(supabase)
  const circle =
    userId !== null ? await getCircleUserIds(supabase, userId) : null
  return { userId, circle }
}

async function queryVerseTexts(
  supabase: SupabaseServer,
  { collection, book, chapter }: ChapterRef,
  languages: string[],
  verses?: number[],
) {
  let query = supabase
    .from('scripture_verses')
    .select('verse, language, text_html')
    .eq('collection_id', collection)
    .eq('book_id', book)
    .eq('chapter', chapter)
    .in('language', languages)
    .order('verse', { ascending: true })
  if (verses?.length) {
    query = query.in('verse', verses)
  }
  const { data } = await query
  return (data ?? []) as VerseText[]
}

// bilingual=false のときは 'ja' のみ取得するため、この関数は常に ja/secondary の
// 2言語までしか扱わない前提でグルーピングする（3言語以上の同時表示は Out of Scope）。
function groupVerseTexts(rows: VerseText[]): Map<number, VerseTextPair> {
  const map = new Map<number, VerseTextPair>()
  for (const row of rows) {
    const entry = map.get(row.verse) ?? { ja: '' }
    if (row.language === 'ja') entry.ja = row.text_html
    else entry.secondary = row.text_html
    map.set(row.verse, entry)
  }
  return map
}
```

- [ ] **Step 5: `fetchVerseData` と `fetchChapterData` を更新する**

`fetchVerseData`（変更前の64-82行目）を以下に置き換える:

```ts
const fetchVerseData = createServerFn({ method: 'POST' })
  .inputValidator((data: ChapterRef & { verses: number[]; bilingual: boolean }) => data)
  .handler(async (ctx) => {
    const { collection, book, chapter, verses, bilingual } = ctx.data
    const languages = bilingual ? ['ja', SECONDARY_LANGUAGE] : ['ja']
    const serverSupabase = await createSupabaseServer()
    const [{ data: posts }, verseTexts, userId] = await Promise.all([
      serverSupabase
        .from('posts')
        .select(POST_SELECT)
        .eq('scripture_collection', collection)
        .eq('scripture_book', book)
        .eq('scripture_chapter', chapter)
        .overlaps('scripture_verses', verses)
        .order('created_at', { ascending: false }),
      queryVerseTexts(serverSupabase, ctx.data, languages, verses),
      queryCurrentUserId(serverSupabase),
    ])
    return { posts: (posts ?? []) as PostWithUser[], verseTexts, userId }
  })
```

`fetchChapterData`（変更前の84-153行目）を以下に置き換える:

```ts
const fetchChapterData = createServerFn({ method: 'POST' })
  .inputValidator((data: ChapterRef & { bilingual: boolean }) => data)
  .handler(async (ctx) => {
    const { collection, book, chapter, bilingual } = ctx.data
    const languages = bilingual ? ['ja', SECONDARY_LANGUAGE] : ['ja']
    const serverSupabase = await createSupabaseServer()

    const [
      { data: posts },
      { data: versePostsData },
      verseTexts,
      { userId, circle },
    ] = await Promise.all([
      serverSupabase
        .from('posts')
        .select(POST_SELECT)
        .eq('scripture_collection', collection)
        .eq('scripture_book', book)
        .eq('scripture_chapter', chapter)
        .is('scripture_verses', null)
        .order('created_at', { ascending: false }),
      serverSupabase
        .from('posts')
        .select(POST_SELECT)
        .eq('scripture_collection', collection)
        .eq('scripture_book', book)
        .eq('scripture_chapter', chapter)
        .not('scripture_verses', 'is', null)
        .order('created_at', { ascending: false }),
      queryVerseTexts(serverSupabase, ctx.data, languages),
      queryUserAndCircle(serverSupabase),
    ])

    const versePosts = (versePostsData ?? []) as PostWithUser[]

    let chapterCommenters: AvatarStackItem[] = []
    let circlePosts: PostWithUser[] = []

    if (circle) {
      const userLookup = new Map(
        circle.users.map((u) => [
          u.id,
          {
            userId: u.id,
            name: u.display_name ?? '匿名ユーザー',
            avatarUrl: u.avatar_url,
          } as AvatarStackItem,
        ]),
      )

      circlePosts = versePosts.filter((p) => userLookup.has(p.user_id))

      const latestByUser = new Map<string, string>()
      for (const p of circlePosts) {
        const prev = latestByUser.get(p.user_id) ?? ''
        const cur = p.created_at ?? ''
        if (cur > prev) latestByUser.set(p.user_id, cur)
      }
      chapterCommenters = [...latestByUser.entries()]
        .sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0))
        .map(([uid]) => userLookup.get(uid)!)
    }

    return {
      posts: (posts ?? []) as PostWithUser[],
      verseTexts,
      userId,
      chapterCommenters,
      circlePosts,
    }
  })
```

- [ ] **Step 6: `ChapterSearch` と `Route` の `validateSearch`/`loaderDeps`/`loader` を更新する**

`ChapterSearch` 型と `Route` 定義（変更前の155-201行目）を以下に置き換える:

```ts
type ChapterSearch = {
  verses?: number[]
  select?: number[]
  mode?: SelectionMode
  bilingual?: boolean
}

export const Route = createFileRoute('/scriptures/$collection/$book/$chapter')({
  validateSearch: (search: Record<string, unknown>): ChapterSearch => ({
    verses: search.verses !== undefined ? parseSelection(search.verses) : undefined,
    select: search.select !== undefined ? parseSelection(search.select) : undefined,
    mode: search.mode === 'select' ? 'select' : undefined,
    bilingual: search.bilingual === true || search.bilingual === 'true' ? true : undefined,
  }),
  loaderDeps: ({ search }) => ({
    verses: search.verses,
    bilingual: search.bilingual,
  }),
  loader: async ({ params, deps }) => {
    const book = getBook(params.collection, params.book)
    if (!book) throw notFound()
    if (!/^\d+$/.test(params.chapter)) throw notFound()
    const chapterNum = parseInt(params.chapter, 10)
    if (chapterNum < 1 || chapterNum > book.chapters) throw notFound()

    const base = { collection: params.collection, book: params.book, chapter: chapterNum }
    const bilingual = deps.bilingual ?? false

    if (deps.verses?.length) {
      const verseCount = book.verses[chapterNum - 1]
      if (deps.verses.some((v) => v < 1 || v > verseCount)) throw notFound()
      const { posts, verseTexts, userId } = await fetchVerseData({ data: { ...base, verses: deps.verses, bilingual } })
      return {
        book, chapter: chapterNum, collection: params.collection,
        mode: 'verse' as const, verses: deps.verses,
        posts, verseTexts, userId,
        chapterCommenters: [] as AvatarStackItem[],
        circlePosts: [] as PostWithUser[],
      }
    }

    const data = await fetchChapterData({ data: { ...base, bilingual } })

    return {
      book, chapter: chapterNum, collection: params.collection,
      mode: 'chapter' as const, verses: [] as number[],
      ...data,
    }
  },
  component: ChapterPage,
})
```

- [ ] **Step 7: `VerseView` を更新する**

`VerseView` 関数全体（変更前の252-314行目）を以下に置き換える:

```tsx
function VerseView({ book, chapter, collection, verses, posts, verseTexts, canCompose }: VerseViewProps) {
  const router = useRouter()
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const [sheetOpen, setSheetOpen] = useState(false)
  const loc = { collection, book: book.id, chapter }
  const scriptureLabel = getScriptureLabel({ ...loc, verses }, book)
  const officialUrl = buildScriptureUrl({ ...loc, verses }, book)
  const bilingual = search.bilingual ?? false
  const verseTextMap = useMemo(() => groupVerseTexts(verseTexts), [verseTexts])

  const onSheetOpenChange = (open: boolean) => {
    setSheetOpen(open)
    if (!open) router.invalidate()
  }

  const toggleBilingual = () => {
    navigate({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection, book: book.id, chapter: String(chapter) },
      search: (prev) => ({ ...prev, bilingual: prev.bilingual ? undefined : true }),
      replace: true,
    })
  }

  return (
    <div>
      <PageHeader
        title={`📖 ${scriptureLabel}`}
        backTo="/scriptures/$collection/$book/$chapter"
        backLabel={book.isFrontMatter ? book.name : `第${chapter}章`}
        action={
          <div className="flex items-center gap-2">
            {canCompose && <ComposeButton onClick={() => setSheetOpen(true)} label="投稿する" />}
            <BilingualToggleButton active={bilingual} onToggle={toggleBilingual} />
            <BookmarkButton loc={loc} />
          </div>
        }
      />
      <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--line)' }}>
        <a
          href={officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline"
          style={{ color: 'var(--lagoon-deep)' }}
        >
          公式サイトで読む →
        </a>
        <span className="text-xs ml-3" style={{ color: 'var(--sea-ink-soft)' }}>新着順</span>
      </div>
      {verseTextMap.size > 0 && (
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
          {[...verseTextMap.entries()].map(([verse, vt]) => (
            <ScriptureText
              key={verse}
              verse={verse}
              textHtml={vt.ja}
              textHtmlSecondary={vt.secondary}
              secondaryLang={bilingual ? SECONDARY_LANGUAGE : undefined}
              showNumber={!book.isFrontMatter}
            />
          ))}
        </div>
      )}
      {posts.length === 0 ? (
        <EmptyState>この節への投稿はまだありません</EmptyState>
      ) : (
        <div>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
      {canCompose && (
        <PostComposerSheet
          open={sheetOpen}
          onOpenChange={onSheetOpenChange}
          initialScripture={{ collection, book: book.id, chapter, verses }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 8: `ChapterView` を更新する**

`ChapterView` 内、`const search = Route.useSearch()` の直後（変更前の336-338行目）に1行追加する:

```tsx
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const maxVerse = book.verses[chapter - 1]
  const bilingual = search.bilingual ?? false
```

`verseTextMap` の構築（変更前の366-369行目）を以下に置き換える:

```tsx
  const verseTextMap = useMemo(() => groupVerseTexts(verseTexts), [verseTexts])
```

`headerAction`（変更前の413-423行目）を以下に置き換える:

```tsx
  const headerAction = (
    <div className="flex items-center gap-2">
      {canCompose && (
        <ComposeMenu
          onSelectChapter={openComposerForChapter}
          onSelectVerses={enterSelectMode}
        />
      )}
      <BilingualToggleButton
        active={bilingual}
        onToggle={() => patchSearch({ bilingual: bilingual ? undefined : true })}
      />
      <BookmarkButton loc={loc} />
    </div>
  )
```

`verseList` 内の `VerseRow` 呼び出し（変更前の480-492行目）を以下に置き換える:

```tsx
                <VerseRow
                  collection={collection}
                  book={book.id}
                  chapter={chapter}
                  verse={verse}
                  textHtml={vt?.ja}
                  textHtmlSecondary={vt?.secondary}
                  secondaryLang={bilingual ? SECONDARY_LANGUAGE : undefined}
                  mode={mode}
                  selected={isSelected}
                  onSelect={(v) => setSelection(toggleVerse(selection, v))}
                  commenterMarker={marker}
                  onMarkerClick={(v) => setOpenVerseSheet(v)}
                  showNumber={!book.isFrontMatter}
                />
```

- [ ] **Step 9: テストを実行して通ることを確認する**

Run: `cd apps/pwa && npx vitest run tests/pages/scriptures/chapter.test.tsx`
Expected: PASS（既存17件 + 新規3件）

- [ ] **Step 10: コミット**

```bash
git add apps/pwa/src/shared/config/scriptureLanguage.ts "apps/pwa/src/pages/scriptures/\$collection/\$book/\$chapter.tsx" apps/pwa/tests/pages/scriptures/chapter.test.tsx
git commit -m "feat: add bilingual (ja/en) verse display toggle to chapter and verse pages"
```

---

### Task 9: ローカルDBへのデータ反映と動作確認（手動/運用ステップ）

Task 1〜8 のコード変更をローカル環境の実データに反映する。ネットワークアクセスを伴うため対話的に実行する。本番DBへのデータ投入はこのタスクでは行わない（別途ユーザー判断で実施）。

**Files:**
- 対象なし（コマンド実行のみ）

- [ ] **Step 1: 型定義を再生成する**

Run: `pnpm supabase:types`
Expected: `packages/database/index.ts` の `scripture_verses.Row/Insert/Update` に `language: string`（Insert/Update は `language?: string`）が追加される

- [ ] **Step 2: 英語データを取得する**

Run: `node scripts/fetch-scriptures.mjs --lang=en`
Expected: `Language: en (English)` から始まり、`Total: 1582 chapters` 前後、レート制限1req/秒で全章を取得完了する（中断した場合は同じコマンドを再実行すれば未完了分から再開する）

- [ ] **Step 3: 日本語データが既存のまま保持されていることを確認する**

Run:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
SELECT language, COUNT(*) FROM scripture_verses GROUP BY language ORDER BY language;
"
```
Expected: `en` と `ja` の2行が表示され、両方の行数がほぼ同数（前付け文書のパース差異程度の誤差のみ）

- [ ] **Step 4: ローカル seed を更新する**

Run: `node scripts/export-verses-seed.mjs`
Expected: `Generated supabase/seed-verses.sql` の行数が Step 2 実行前のおよそ2倍になる

- [ ] **Step 5: フロントエンドが実データで正しく表示されることを確認する**

Run: `pnpm dev`（別ターミナル）
Browser: `http://localhost:3000/scriptures/bofm/1-ne/1` を開く

Expected:
- ヘッダーの日英併記ボタンをクリックすると、各節の日本語テキストの下（画面幅が広い場合は右側）に英語テキストが表示される
- もう一度クリックすると英語テキストが消え、URLの `bilingual` パラメータも消える
- 単一節ビュー（`?verses=1`）でも同様にボタンが機能する
- ブラウザ幅を `lg` ブレークポイント（1024px）前後でリサイズすると、日英が縦並び⇄左右2カラムに切り替わる

- [ ] **Step 6: 全テストスイートを実行する**

Run: `node --test scripts/lib/*.test.mjs && pnpm --filter @manna/pwa test`
Expected: 全て PASS

---

## Self-Review Notes

- **Spec coverage**: 仕様書の「データ層」（スキーマ変更・取得スクリプト・seedエクスポート）は Task 1・2・3・4、「クエリ / ローダー変更」は Task 8、「UI / トグル・表示」（トグルボタン・レイアウト・パラメータ引き継ぎ）は Task 5・6・7・8、「テスト方針」の4項目は Task 5〜8 の各TDDサイクルで満たしている。「ロールアウト手順」は Task 9 でカバーし、仕様書の Out of Scope（言語ピッカーUI・3言語以上・全文検索の言語対応・トグル状態の永続化）はこの計画でも実装しない
- **Placeholder scan**: 「TBD」「後で実装」等の記述なし。全ステップに実コードを記載済み
- **Type consistency**: `VerseText`（`{ verse, language, text_html }`）と `VerseTextPair`（`{ ja, secondary? }`）は Task 8 で定義し、`ScriptureText`/`VerseRow` の `textHtmlSecondary`/`secondaryLang` prop名（Task 5・6で定義）と統一して使用している。`SECONDARY_LANGUAGE` は Task 8 で作成し、以降その1箇所のみを参照する
- **既存バグの修正**: Task 3 で `fetch-scriptures.mjs` の再取得時 `DELETE` 文に `language` 条件が無く他言語のデータまで消えてしまう問題を修正している（元のコードにあった潜在バグ、他言語対応で顕在化するため今回のスコープに含めた）
