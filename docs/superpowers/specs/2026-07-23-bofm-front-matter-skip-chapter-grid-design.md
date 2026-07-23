# モルモン書 前付け文書の章選択画面スキップ 設計

- 日付: 2026-07-23
- ステータス: 設計承認済み・実装計画待ち

## 背景・目的

モルモン書の前付け文書5つ（`bofm-title` / `introduction` / `three` / `eight` / `js`。詳細は [`docs/superpowers/specs/2026-07-23-bofm-front-matter-design.md`](2026-07-23-bofm-front-matter-design.md) 参照）は既存の書/章/節インフラを再利用するため `chapters: 1` の擬似的な書として実装されている。

そのため、書一覧（`/scriptures/bofm`）でこれらの書をタップすると、既存の1章書（エノス書など）と同じ「章を選んでください」というグリッド画面（`/scriptures/$collection/$book/`、1のボタンが1つだけ表示される）を経由してから本文に到達する。前付け文書には章という概念自体が無いため、このワンタップだけの中間画面は不要なUXの手間になっている。

このタスクは前付け文書に限り、章選択グリッド画面を完全にスキップして本文へ直接遷移させる。

## スコープ

- 対象: `book.isFrontMatter === true` の5書のみ
- 既存の「全体が1章だけ」の通常書（エノス書・ジャロム書・オムナイ書・モルモンの言葉・第4ニーファイ書）は対象外。現状通りグリッド画面を経由する

### Out of Scope

- 通常書（1章書含む）のナビゲーション動線の変更
- DBスキーマ・データの変更（既存の `is_front_matter` フラグをそのまま利用する）

## 設計

### 1. 章選択グリッドページでのリダイレクト

`apps/pwa/src/pages/scriptures/$collection/$book/index.tsx` の `loader` で、`book.isFrontMatter` が true の場合は即座に `/scriptures/$collection/$book/$chapter`（`chapter: '1'`）へリダイレクトする。

```tsx
import { createFileRoute, Link, notFound, redirect } from '@tanstack/react-router'
import { getBook, getCollection } from '@/entities/scripture'
import { PageHeader } from '@/shared/ui'

export const Route = createFileRoute('/scriptures/$collection/$book/')({
  loader: ({ params }) => {
    const book = getBook(params.collection, params.book)
    const collection = getCollection(params.collection)
    if (!book || !collection) throw notFound()
    if (book.isFrontMatter) {
      throw redirect({
        to: '/scriptures/$collection/$book/$chapter',
        params: { collection: params.collection, book: params.book, chapter: '1' },
      })
    }
    return { book, collection }
  },
  component: BookPage,
})
```

このリダイレクトはloader内で発生するため、書一覧ページのリンク（`/scriptures/$collection/$book` 宛て）や、ブックマーク・直接URLアクセス・ブラウザの戻るボタンなど、どの経路でこのページに来ても等しく適用される。**書一覧ページ自体（`$collection/index.tsx`）のリンクは変更不要**。

### 2. 本文ページの「戻る」ボタンの遷移先変更

上記のリダイレクトにより、前付け文書の本文ページ（`ChapterView`）で「戻る」ボタンを押して章選択グリッド画面（`/scriptures/$collection/$book`）に戻ると、loaderが即座にまた本文へリダイレクトしてしまい、ユーザーが書一覧に戻れなくなる。

これを避けるため、`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` の `ChapterView` の `chapterHeader`（427行目付近）で、前付け文書の場合は「戻る」の遷移先を書一覧ページ（`/scriptures/$collection`）に変更する。

```tsx
const collectionName = getCollection(collection)?.name ?? collection

const chapterHeader = (
  <>
    <PageHeader
      title={getScriptureLabel(loc, book)}
      backTo={book.isFrontMatter ? '/scriptures/$collection' : '/scriptures/$collection/$book'}
      backLabel={book.isFrontMatter ? collectionName : book.name}
      action={headerAction}
    />
```

`getCollection` は `@/entities/scripture` から追加でimportする（`getBook` と同じ静的JSON参照の軽量な同期関数）。

`title` は既存の `getScriptureLabel(loc, book)` 呼び出し（前付け文書実装時に既にこの形へリファクタ済み）をそのまま使うため変更不要 — 変更が必要なのは `backTo`/`backLabel` の2行のみ。

### 影響を受けないもの

- `VerseView`（節詳細表示）の「戻る」ボタンは章/本文ページ（`$chapter`）に戻るだけで、章選択グリッドを経由しないため変更不要
- 既存の1章書（エノス書など）は `book.isFrontMatter` が undefined/false のため、上記2箇所とも従来通りの分岐（グリッド画面経由・書ページへ戻る）のまま
- DBスキーマ・`scriptures.json`・節データは変更なし

## テスト計画

- `apps/pwa/src/pages/scriptures/$collection/$book/index.tsx` にはテストファイルが存在しないため新規作成（TDD）: front matter book の loader が `redirect()` をthrowすること、通常書は従来通り `{book, collection}` を返すことを検証
- `apps/pwa/tests/pages/scriptures/chapter.test.tsx`（既存）に front matter book の場合の `backTo`/`backLabel` ケースを追加

## 自己レビュー

- プレースホルダーなし。コードは全て具体的
- スコープは前付け5書のみに限定されており、既存書・DBには影響しない
- 「戻る」ボタンのループ問題を明示的に解決している
