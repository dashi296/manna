# モルモン書 前付け文書の段落番号非表示 設計

- 日付: 2026-07-24
- ステータス: 設計承認済み・実装計画待ち

## 背景・目的

モルモン書の前付け文書5書（`bofm-title`/`introduction`/`three`/`eight`/`js`。詳細は [`docs/superpowers/specs/2026-07-23-bofm-front-matter-design.md`](2026-07-23-bofm-front-matter-design.md) 参照）は、既存の書/章/節インフラを再利用するため段落を「節」として扱っている。

しかし前付け文書の元データ（教会公式サイトのHTML）自体には節番号という概念が存在しない。通常章のHTMLは `<p class="verse"><span class="verse-number">1</span>...</p>` の形で節番号が明示されるが、前付け文書は番号なしの `<p>...</p>` の並びだけであり、現在アプリで表示されている「1, 2, 3...」という番号は `scripts/lib/parse-paragraphs.mjs` が段落の出現順に付けた合成的な連番である（実データではない）。

前付け文書は文章として読むもの（タイトルページ・序文・証人の証）であり、番号付きの「節」として提示するのは不自然。この番号表示を前付け文書に限りやめる。

## スコープ

- 対象: `book.isFrontMatter === true` の5書のみ。通常書の節番号表示は一切変更しない
- 番号を隠す範囲: 以下3箇所すべて
  1. 章一覧の読書ビュー（`ChapterView` の `VerseRow`、読み取りモード）
  2. 投稿作成時の段落選択モード（`ChapterView` の `VerseRow`、選択モード — 同じコンポーネントを再利用しているため自動的に対象になる）
  3. 特定の段落だけを抜き出した詳細ビュー（`VerseView` の `ScriptureText`）

### Out of Scope

- `getScriptureLabel()` が返す `序文 1:4` 形式のラベル表記（既存のまま維持。今回は本文中に表示される段落先頭の番号バッジのみが対象）
- 投稿作成時の「節 (例: 7, 9)」テキスト入力欄（段落番号を指定して投稿を紐付ける機能自体は維持する。表示上の見た目だけを変更する）
- DBスキーマ・データの変更

## 設計

### 1. `ScriptureText` に `showNumber` プロパティを追加する

`apps/pwa/src/shared/ui/ScriptureText.tsx` の `Props` に `showNumber?: boolean`（デフォルト `true`）を追加し、`false` のときは番号の `<span>` を描画しない。

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

### 2. `VerseRow` に `showNumber` プロパティを追加する

`apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx` の `Props` に `showNumber?: boolean`（デフォルト `true`）を追加する。読み取りモード・選択モードの両方で使われる共通の `inner` ブロック内の番号 `<span>` を条件分岐し、番号を隠す場合は本文テキストの `ml-2`（番号との間隔用マージン）も外す。

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
  // ...
  const inner = (
    <div className="flex items-start gap-2 px-4 py-3">
      {mode === 'select' && ( /* 既存のチェックマークUI、変更なし */ )}
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
            <SanitizedVerseHtml
              html={textHtml}
              className={showNumber ? 'ml-2 text-sm' : 'text-sm'}
              style={{ color: 'var(--sea-ink)' }}
            />
          )}
        </div>
      </div>
    </div>
  )
  // ...
}
```

### 3. 呼び出し側で `book.isFrontMatter` を渡す

`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` の2箇所:

- `VerseView` 内の `ScriptureText` 呼び出し（289-294行目付近）に `showNumber={!book.isFrontMatter}` を追加
- `ChapterView` 内の `VerseRow` 呼び出し（480行目付近）に `showNumber={!book.isFrontMatter}` を追加

`ChapterView` は選択モード（`mode === 'select'`）も同じ `VerseRow` コンポーネントを描画しているため、この1箇所の変更で読み取りモード・選択モードの両方に自動的に適用される。

## 影響を受けないもの

- `getScriptureLabel()`・`buildScriptureUrl()` — 「1:4」形式のラベルや公式サイトリンクの `id=p4` アンカーは変更しない
- 投稿作成時の「節 (例: 7, 9)」テキスト入力欄（`ScriptureSelector.tsx`）— 段落を指定して投稿を紐付ける機能自体は維持する
- DBスキーマ・`scriptures.json`・節データ

## テスト計画

- `apps/pwa/tests/shared/ui/ScriptureText.test.tsx`（既存）に `showNumber={false}` で番号が表示されないケースを追加
- `apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx`（既存）に `showNumber={false}` で番号が表示されない（read/select 両モード）ケースを追加
- `apps/pwa/tests/pages/scriptures/chapter.test.tsx`（既存）に、front matter の書では章一覧・節詳細のいずれでも番号が表示されないケースを追加

## 自己レビュー

- プレースホルダーなし。コードは全て具体的
- スコープは前付け5書・番号バッジ表示のみに限定されており、ラベル表記・DBには影響しない
- 選択モードへの影響も明記済み（`VerseRow` 共通化により自動適用）
