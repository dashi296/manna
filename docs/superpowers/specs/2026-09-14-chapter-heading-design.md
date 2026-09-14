# 章タイトルと章の概要文の表示 設計

- 日付: 2026-09-14
- 対象 issue: #154

## 背景

章表示画面は sticky ヘッダーに「第n章」を出すだけで、本文側には何もない。公式の章ページには節の前にタイトルと概要（要約）が置かれており、読む前に章の内容を掴む手がかりになっている。

調査したところ、**このデータは取得元のレスポンスに含まれており、いまの取り込みで捨てていた**。`scripts/lib/parse-verses.mjs` の `parseVerses` は `<p class="verse">` だけを拾っている。

| 要素 | 内容 |
|---|---|
| `<p class="title-number">` | 章のタイトル（「第5章」「第23篇」）|
| `<p class="study-summary">` | 章の概要文 |

概要があるのは回復された聖典（モルモン書・教義と聖約・高価な真珠）だけで、旧約聖書・新約聖書には段落自体が無い。概要の長さはルビ込みで157〜545文字（教義と聖約が長い）。

## 決めたこと

- 概要は**常に全文を出す**。畳むと「読む前に内容を掴む」という役目を果たさない
- 本文のタイトルは取得した `title` を使う。加えて `getChapterLabel` も直し、画面内で表記が割れないようにする

## データ

### テーブル

```sql
CREATE TABLE scripture_chapter_headings (
  collection_id text NOT NULL,
  book_id       text NOT NULL,
  chapter       integer NOT NULL,
  language      text NOT NULL DEFAULT 'ja',
  title         text NOT NULL,
  summary       text,
  summary_html  text,
  PRIMARY KEY (collection_id, book_id, chapter, language),
  FOREIGN KEY (collection_id, book_id)
    REFERENCES scripture_books(collection_id, id) ON DELETE CASCADE
);
```

RLS は `scripture_verses` と同じく anon / authenticated に SELECT を開ける。概要が無い章は `summary` / `summary_html` を NULL にする（行自体は作る。タイトルは全章にある）。

約3,174行（1,587章 × 2言語）。節テキストの84,052行に比べれば小さい。

### 取り込み

`parse-verses.mjs` に `parseChapterHeading(html)` を足し、`fetch-scriptures.mjs` が節と**同じレスポンスから**保存する。追加の通信は発生しない。

取得済みの判定は現在「節数の一致」で見ている（`getCompletedChapters`）。見出しは別テーブルなので、**見出しが無い章だけを対象にする判定**を足す。既存の節データは取り直さない。

本番へは `DATABASE_URL` を本番に向けて同じスクリプトを流す（節データと同じ経路）。レート制限が1秒間隔のため、両言語で50分前後かかる。

### ローカル seed

`scripts/export-verses-seed.mjs` の出力に見出しを含め、`db-reset.sh` で復元されるようにする。

## 章ラベル

87書すべての `title-number` を確認したところ、「第n章」でないのは**詩篇（第n篇）だけ**だった。

`scriptures.json` の詩篇に `chapterUnit: "篇"` を足し、`getChapterLabel` を次のようにする。

```typescript
return book?.isFrontMatter ? book.name : `第${chapter}${book.chapterUnit ?? '章'}`
```

書のメタデータは `scriptures.json` が唯一の参照元（DB の `scripture_books` はアプリから読んでいない）なので、この変更だけでヘッダー・投稿の聖典ラベル・章移動リンクが揃う。

## 取得（アプリ側）

`entities/scripture` に `chapterHeadingQuery(ref, language)` を追加する。**節本文の `verseTextsQuery` と同じ作り**にそろえる（キーファクトリ + `queryOptions`、`staleTime: Infinity`、セッションを持たない匿名クライアント）。

SSR のローダーは節本文と並べて `ensureQueryData` で温める。

## 表示

`ChapterView` の節一覧の前にタイトルと概要を置く。概要はルビ付き HTML なので `SanitizedVerseHtml` を通す。

- 併記がオンなら概要も両言語（節本文と同じ扱い）
- 概要が無い章はタイトルのみ。余白を余らせない
- 前付け文書（`isFrontMatter`）は対象外

## スワイプのプレビュー

`features/swipe-chapter-navigation` のプレビューにも同じタイトルと概要を描く。描かないと、指を離した瞬間に本文が概要の高さぶん飛ぶ（プレビューと遷移後の縦位置は #152 で実測して揃えてある）。

先読み（`useAdjacentChapterTexts`）に見出しのクエリを足す。アイドル時のクエリは前後 × 言語で最大4本から8本になる。

## テスト

- `parseChapterHeading`: タイトルのみ / タイトル + 概要 / どちらも無い
- `getChapterLabel`: 詩篇は篇、他は章、前付け文書は書名
- 章画面: 概要あり / 概要なし / 併記オン
- キャッシュ共有: ローダーが温めた見出しをページ本体が取り直さない（節本文と同じ形のテスト）
- プレビューと遷移後で本文の縦位置が一致すること（既存の実測スクリプトを拡張）

## 決着した点

`scripts/lib/*.test.mjs` は CI で実行されていなかった（CI の `pnpm test` はルートの
`pnpm --filter @manna/pwa test` に解決される）。今回パーサを足すので、ルートに
`test:scripts` を作り CI の check ジョブに加えた。
