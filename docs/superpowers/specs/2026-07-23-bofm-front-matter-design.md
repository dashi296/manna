# モルモン書 序文・証人の証 組み込み 設計

- 日付: 2026-07-23
- ステータス: 設計承認済み・実装計画待ち

## 背景・目的

モルモン書には、通常の書（第1ニーファイ書など）とは別に、章立てのない前付け文書が5つ存在する。現在アプリにはこれらのデータが存在しないため、組み込む。

対象文書（教会公式サイトの URI セグメントをそのまま `scripture_books.id` として採用）:

| id | 名前 | 段落数 |
|---|---|---|
| `bofm-title` | モルモン書のタイトルページ | 4 |
| `introduction` | 序文 | 9 |
| `three` | 三人の証人の証 | 4 |
| `eight` | 八人の証人の証 | 9 |
| `js` | 預言者ジョセフ・スミスの証 | 25 |

段落数は `https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content?lang=jpn&uri=/scriptures/bofm/<id>` の実レスポンスから `<p>` タグをカウントして確認済み。

これらのページは通常の章とは異なり `<p class="verse"><span class="verse-number">…</span>…</p>` ではなく、番号なしの `<p ...>…</p>` の並びである。既存の `parseVerses()` はこの構造をパースできない。

## スコープ

- 上記5文書すべてを組み込む
- 各文書は「1章・段落数ぶんの節を持つ擬似的な書」として `scripture_books` / `scripture_verses` に格納し、既存の節選択・投稿タグ付け（`posts.scripture_verses` の `overlaps` 検索）・全文検索（GIN index）インフラをそのまま再利用する
- 章番号を持たない書であることを示す `is_front_matter` フラグを追加し、「◯◯ 第1章」のような不自然なラベルが出ないようにフロントエンド側の表示を分岐する

### Out of Scope

- 前付け文書専用の新規テーブル設計（既存の book/chapter/verse 構造を再利用するため不要）
- 章グリッドをタップして進む既存のナビゲーション動線の変更（`chapters=1` の既存書、例: エノス書と同じ挙動のままにする）
- モルモン書以外のコレクション（教義と聖約、旧約聖書等）の前付け文書対応

## データモデル

### マイグレーション（新規ファイル）

```sql
ALTER TABLE scripture_books
  ADD COLUMN IF NOT EXISTS is_front_matter boolean NOT NULL DEFAULT false;
```

### `apps/pwa/src/shared/config/scriptures.json`

`bofm.books` 配列の**先頭**（`1-ne` より前）に5エントリを追加する。配列の並び順がそのまま DB の `sort_order` になる仕組み（`export-books-seed.mjs` が配列インデックスを `sort_order` として書き出す）なので、追加の並び替えは不要。

```json
{ "id": "bofm-title", "name": "モルモン書のタイトルページ", "chapters": 1, "verses": [4], "isFrontMatter": true },
{ "id": "introduction", "name": "序文", "chapters": 1, "verses": [9], "isFrontMatter": true },
{ "id": "three", "name": "三人の証人の証", "chapters": 1, "verses": [4], "isFrontMatter": true },
{ "id": "eight", "name": "八人の証人の証", "chapters": 1, "verses": [9], "isFrontMatter": true },
{ "id": "js", "name": "預言者ジョセフ・スミスの証", "chapters": 1, "verses": [25], "isFrontMatter": true },
```

既存の書エントリは変更しない（`isFrontMatter` フィールドを持たない = falsy 扱い）。

### `scripts/export-books-seed.mjs`

`is_front_matter` 列も `supabase/seed.sql` に書き出すよう修正する（`b.isFrontMatter ?? false` を SQL の boolean リテラルに変換）。

## パーサー: `scripts/lib/parse-paragraphs.mjs`（新規）

`<p class="verse">` + `<span class="verse-number">` を前提とする既存 `parseVerses()` に対し、前付け文書は番号なしの `<p ...>` のみ（`class` は `subtitle` / `signature` / なし など一定しない）。

- `study-note-ref` の展開、`sup.marker` の除去、ruby 以外のタグ除去といった HTML クリーンアップ処理は `parseVerses()` と共通なので `cleanVerseHtml(innerHtml)` として `parse-verses.mjs` から切り出し、両パーサーで共有する
- `parseParagraphs(html)` は本文中の `<p>...</p>` を出現順に抽出し、1 から始まる連番を "verse" 番号として付与して返す（戻り値の形は `parseVerses()` と同じ `{ verse, text, textHtml }[]`）

テストは TDD で `scripts/lib/parse-paragraphs.test.mjs` に既存 `parse-verses.test.mjs` と同じパターンで作成する。

## 取得スクリプト: `scripts/fetch-scriptures.mjs`

- `buildChapterList()` で `book.isFrontMatter` の書は「章数=1・章番号なしURI」として区別する
- URL 組み立てを分岐する。front matter は `uri = /scriptures/${collectionId}/${bookId}`（末尾に章番号を付けない）。実際に `/scriptures/bofm/introduction/1` を curl で試した結果、末尾に `1` を付けるとモルモン書のトップページの内容が返ってくることを確認済みのため、この分岐は必須
- パースは front matter なら `parseParagraphs`、通常章なら従来通り `parseVerses`
- DB への `INSERT` 先・カラムは変わらず `scripture_verses (collection_id, book_id, chapter=1, verse, text, text_html)`

## フロントエンド: 章ラベル表示の分岐

`book.isFrontMatter === true` の場合に「第◯章」を省略する必要がある箇所は6つ（当初のコードベース調査で4箇所、設計中に公式サイトへの外部リンク生成で302リダイレクトの問題をさらに1箇所発見、Codexレビューで `VerseView` の戻りラベルの見落としを1箇所指摘）:

1. `pages/scriptures/$collection/$book/$chapter.tsx` の `ChapterView` — 章ビューのタイトル `${book.name} 第${chapter}章`（428行目）→ front matter なら `book.name` のみ
2. `pages/scriptures/$collection/$book/$chapter.tsx` の `VerseView` — 節（段落）詳細ビューの `backLabel={`第${chapter}章`}`（269行目）→ front matter なら `book.name` のみ。`ChapterView` のタイトルとは別コンポーネント・別箇所なので、1. を直しただけでは戻りラベルに「第1章」が残る
3. `shared/lib/scriptureUtils.ts` の `getScriptureLabel()` — 節指定なし時の `${bookName} 第${chapter}章` → front matter なら `bookName` のみ（節指定ありの `1:4` 形式はそのまま）
4. `shared/lib/scriptureUtils.ts` の `buildScriptureUrl()` — 教会公式サイトへのリンク生成。`.../bofm/introduction/1?lang=jpn` は **302 で `/study/scriptures/bofm?lang=jpn`（モルモン書トップ）にリダイレクトされてしまう**ことを curl で確認済み。front matter は章番号セグメントを省いた URL（`.../bofm/introduction?lang=jpn`）を生成する
5. `pages/scriptures/$collection/index.tsx` — 書一覧の「1章 ›」表示 → front matter なら章数表示を省略
6. `features/select-scripture/ui/ScriptureSelector.tsx` — 投稿作成時の章選択ドロップダウン → front matter は「第1章」ラベルを出さない

チャプター選択グリッドをタップして進む既存の2段階ナビゲーション自体は変更しない（Out of Scope 参照）。

## テスト計画

- `scripts/lib/parse-paragraphs.test.mjs`（新規、TDD）
- 上記フロントエンド6箇所について、既存テストがあれば `isFrontMatter=true` ケースを追加

## 実装後の手動作業（実装計画の一部）

- `node scripts/fetch-scriptures.mjs` を実行し、新規5文書のデータをローカル DB に取得
- `node scripts/export-verses-seed.mjs` で `supabase/seed-verses.sql`（gitignore・ローカルのみ）を更新
- `node scripts/export-books-seed.mjs` で `supabase/seed.sql`（git管理）を更新
