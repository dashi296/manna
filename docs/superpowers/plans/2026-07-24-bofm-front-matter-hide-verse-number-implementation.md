# モルモン書 前付け文書の段落番号非表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** モルモン書の前付け文書5書（`bofm-title`/`introduction`/`three`/`eight`/`js`）の本文表示（章一覧・段落選択モード・節詳細表示）で、実データに存在しない合成連番（1, 2, 3...）を表示しないようにする。

**Architecture:** 段落番号を描画する2つの共有コンポーネント（`ScriptureText`・`VerseRow`）に `showNumber?: boolean`（デフォルト `true`）プロパティを追加し、呼び出し側（`$chapter.tsx`）で `!book.isFrontMatter` を渡す。`VerseRow` は読み取りモード・選択モードの両方で使われる共通ブロックのため、1箇所の変更で両モードに適用される。

**Tech Stack:** React、TypeScript、Vitest + Testing Library

## Global Constraints

- 対象は `book.isFrontMatter === true` の5書のみ。通常書の節番号表示は一切変更しない — 詳細設計 `docs/superpowers/specs/2026-07-24-bofm-front-matter-hide-verse-number-design.md` 参照
- `getScriptureLabel()` の `序文 1:4` 形式のラベル表記・投稿作成時の「節 (例: 7, 9)」テキスト入力欄は変更しない（Out of Scope）
- DBスキーマ・データは変更しない
- コメントは原則不要。WHY が自明でない場合のみ1行（`CLAUDE.md`）

---

### Task 1: `ScriptureText` に `showNumber` プロパティを追加する（TDD）

**Files:**
- Modify: `apps/pwa/src/shared/ui/ScriptureText.tsx`
- Test: `apps/pwa/tests/shared/ui/ScriptureText.test.tsx`（既存）

**Interfaces:**
- Produces: `ScriptureText` の `Props` に `showNumber?: boolean`（デフォルト `true`）が追加される。`false` のとき節番号の `<span>` を描画しない（Task 3 が消費）

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/shared/ui/ScriptureText.test.tsx` の `describe('ScriptureText', ...)` ブロック末尾（最後の `it` の後、閉じ `})` の直前）に追加:

```tsx
  it('showNumber=false のとき節番号を表示しない', () => {
    render(<ScriptureText verse={7} textHtml="テキスト" showNumber={false} />)
    expect(screen.queryByText('7')).toBeNull()
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm --filter @manna/pwa test tests/shared/ui/ScriptureText.test.tsx`
Expected: FAIL（`showNumber` プロパティが存在せず、常に節番号 `7` が描画されるため `queryByText('7')` が要素を返してしまう）

- [ ] **Step 3: `showNumber` プロパティを実装する**

`apps/pwa/src/shared/ui/ScriptureText.tsx` の末尾（`type Props` 以降）を以下に置き換える:

```tsx
type Props = {
  verse: number
  textHtml: string
  className?: string
  showNumber?: boolean
}

export function ScriptureText({ verse, textHtml, className, showNumber = true }: Props) {
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
      <SanitizedVerseHtml html={textHtml} style={{ color: 'var(--sea-ink)' }} />
    </div>
  )
}
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `pnpm --filter @manna/pwa test tests/shared/ui/ScriptureText.test.tsx`
Expected: `tests 4 passed`（既存3件 + 新規1件）

- [ ] **Step 5: コミット**

```bash
git add apps/pwa/src/shared/ui/ScriptureText.tsx apps/pwa/tests/shared/ui/ScriptureText.test.tsx
git commit -m "feat: add showNumber prop to ScriptureText"
```

---

### Task 2: `VerseRow` に `showNumber` プロパティを追加する（TDD）

**Files:**
- Modify: `apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx`
- Test: `apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx`（既存）

**Interfaces:**
- Produces: `VerseRow` の `Props` に `showNumber?: boolean`（デフォルト `true`）が追加される。`false` のとき節番号の `<span>` を `mode='read'`・`mode='select'` の両方で描画しない（Task 3 が消費）

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx` の末尾（ファイル末尾、既存の最後の `})` の直後）に追加:

```tsx

describe('VerseRow showNumber', () => {
  it("showNumber=false のとき mode='read' で節番号を表示しない", async () => {
    renderInRouter(
      <VerseRow {...baseProps} mode="read" selected={false} onSelect={vi.fn()} showNumber={false} />,
    )
    await waitFor(() => {
      expect(screen.queryByText('19')).toBeNull()
    })
  })

  it("showNumber=false のとき mode='select' でも節番号を表示しない", async () => {
    renderInRouter(
      <VerseRow {...baseProps} mode="select" selected={false} onSelect={vi.fn()} showNumber={false} />,
    )
    await waitFor(() => {
      expect(screen.queryByText('19')).toBeNull()
      expect(screen.getByRole('checkbox', { name: '19節を選択' })).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm --filter @manna/pwa test tests/features/select-scripture-verses/VerseRow.test.tsx`
Expected: FAIL（`showNumber` プロパティが存在せず、常に節番号 `19` が描画されるため両テストとも `queryByText('19')` が要素を返してしまう）

- [ ] **Step 3: `showNumber` プロパティを実装する**

`apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx` の `type Props` と `export function VerseRow(...)` の引数リストを以下に置き換える:

```tsx
type Props = {
  collection: string
  book: string
  chapter: number
  verse: number
  textHtml?: string
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
  mode,
  selected,
  onSelect,
  commenterMarker,
  onMarkerClick,
  showNumber = true,
}: Props) {
```

続けて、同ファイル内の `inner` の定義（節番号とテキストを描画している部分）を以下に置き換える:

```tsx
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
            <SanitizedVerseHtml
              html={textHtml}
              className={showNumber ? 'ml-2 text-sm' : 'text-sm'}
              style={{ color: 'var(--sea-ink)' }}
            />
          )}
        </div>
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `pnpm --filter @manna/pwa test tests/features/select-scripture-verses/VerseRow.test.tsx`
Expected: `tests 7 passed`（既存5件 + 新規2件）

- [ ] **Step 5: コミット**

```bash
git add apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx
git commit -m "feat: add showNumber prop to VerseRow"
```

---

### Task 3: `$chapter.tsx` で `showNumber={!book.isFrontMatter}` を渡す（TDD）

**Files:**
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx`
- Test: `apps/pwa/tests/pages/scriptures/chapter.test.tsx`（既存）

**Interfaces:**
- Consumes: `ScriptureText` の `showNumber` プロパティ（Task 1）、`VerseRow` の `showNumber` プロパティ（Task 2）

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/pages/scriptures/chapter.test.tsx` の `describe('ChapterPage', ...)` ブロック末尾（最後の `it` の後、閉じ `})` の直前）に追加:

```ts
  it('front matter の章表示では段落番号を表示しない', () => {
    loaderData = {
      ...baseChapterData,
      book: { id: 'introduction', name: '序文', chapters: 1, verses: [9], isFrontMatter: true },
    }
    render(<ChapterPage />)
    expect(screen.queryByText('1')).toBeNull()
    expect(screen.queryByText('2')).toBeNull()
  })

  it('front matter の節表示では段落番号を表示しない', () => {
    loaderData = {
      ...baseChapterData,
      mode: 'verse',
      verses: [1],
      book: { id: 'introduction', name: '序文', chapters: 1, verses: [9], isFrontMatter: true },
    }
    render(<ChapterPage />)
    expect(screen.queryByText('1')).toBeNull()
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm --filter @manna/pwa test tests/pages/scriptures/chapter.test.tsx`
Expected: 新規2件が FAIL（`showNumber` を渡していないため、両ケースとも段落番号が表示されてしまう）

- [ ] **Step 3: `VerseView` 内の `ScriptureText` 呼び出しに `showNumber` を渡す**

`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` の `<ScriptureText key={vt.verse} verse={vt.verse} textHtml={vt.text_html} />` を以下に変更:

```tsx
            <ScriptureText key={vt.verse} verse={vt.verse} textHtml={vt.text_html} showNumber={!book.isFrontMatter} />
```

- [ ] **Step 4: `ChapterView` 内の `VerseRow` 呼び出しに `showNumber` を渡す**

同ファイルの `VerseRow` 呼び出し（`commenterMarker={marker}` / `onMarkerClick={(v) => setOpenVerseSheet(v)}` の直後）に `showNumber` を追加:

```tsx
                  commenterMarker={marker}
                  onMarkerClick={(v) => setOpenVerseSheet(v)}
                  showNumber={!book.isFrontMatter}
                />
```

- [ ] **Step 5: テストを実行して通ることを確認する**

Run: `pnpm --filter @manna/pwa test tests/pages/scriptures/chapter.test.tsx`
Expected: `tests 20 passed`（既存18件 + 新規2件）

- [ ] **Step 6: pwa の全テストを実行し回帰がないことを確認する**

Run: `pnpm --filter @manna/pwa test`
Expected: 全テスト PASS（既存216件 + Task 1〜3 の新規5件 = 221件）

- [ ] **Step 7: コミット**

```bash
git add apps/pwa/src/pages/scriptures/\$collection/\$book/\$chapter.tsx apps/pwa/tests/pages/scriptures/chapter.test.tsx
git commit -m "feat: hide synthetic paragraph numbers for BoM front matter documents"
```

---

## Self-Review メモ

- 設計ドキュメントの3箇所（章一覧、選択モード、節詳細）は Task 1〜3 でカバーしている。選択モードは `VerseRow` の共通化により Task 2 の1変更で自動的にカバーされる
- ラベル表記（`getScriptureLabel`）・投稿作成時の節入力欄は今回のタスクで一切触れておらず、Out of Scope が守られている
- Task 1・2 は独立したコンポーネント単位、Task 3 は両者の呼び出し側統合という自然な分割になっている
