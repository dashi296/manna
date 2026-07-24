# 日英併記表示機能 設計

- 日付: 2026-07-24
- ステータス: 設計承認済み・実装計画待ち

## 背景・目的

聖典を読む際、日本語と英語の原文を見比べたいというニーズがある。章ページ・単一節ページで、日本語テキストに加えて英語テキストを同時に表示できるトグル機能を追加する。

アーキテクチャは将来の多言語対応（日英以外の言語ペア）を見据えて汎用化するが、今回実装するのは **日本語＋英語の2言語のみ**。言語選択ピッカーUIや3言語以上の同時表示は今回のスコープ外（[Out of Scope](#out-of-scope) 参照）。

## データ層

### スキーマ変更（新規マイグレーション）

```sql
ALTER TABLE scripture_verses ADD COLUMN language text NOT NULL DEFAULT 'ja';
-- PK を (collection_id, book_id, chapter, verse) → (collection_id, book_id, chapter, verse, language) に拡張
```

- 既存データは全て `language='ja'` として扱う（デフォルト値でバックフィルされるため追加の UPDATE 不要）
- `scripture_verses` の PK を参照する外部キーは他テーブルに存在しないため、PK 拡張は安全
- GIN 全文検索インデックス（`text` 列）は現状アプリコードから未使用と確認済み。今回は触らない。将来言語別の全文検索が必要になった時点で `language` 列を条件に加える形で対応する

### 取得スクリプト拡張（`scripts/fetch-scriptures.mjs`）

教会公式API（`churchofjesuschrist.org/study/api/v3/language-pages/type/content`）は英語版も日本語版と同一の HTML 構造（`<p class="verse">` / `<span class="verse-number">`、ルビなし）で提供していることを実機確認済み。前付け文書（`parseParagraphs` 経由）も同じ `insertVerses` を通るため自動的に対応する。

言語コードを直書きせず、レジストリで管理する:

```js
// scripts/lib/languages.mjs
export const LANGUAGES = {
  ja: { apiCode: 'jpn', label: '日本語' },
  en: { apiCode: 'eng', label: 'English' },
}
```

- CLI フラグ `--lang=<code>` を追加（デフォルト `ja`）。`LANGUAGES` を引いて API コードにマッピングする。未登録コードはエラーで停止する
- `getCompletedChapters()` の中断再開チェックと `insertVerses()` に `language` を追加し、言語ごとに独立して進捗管理・スキップ判定する（既存の「章単位で中断再開できる」挙動を言語ごとに保つ）
- 新しい言語を追加する際は `LANGUAGES` にエントリを1つ足して `--lang=xx` を実行するだけで済み、スクリプト本体のロジック変更は不要

### seed エクスポート更新（`scripts/export-verses-seed.mjs` / `scripts/db-reset.sh`）

- `COPY` の列リストに `language` を追加する
- `supabase/seed-verses.sql` は日英両方の行を含むようになる（行数はほぼ倍増）。`db-reset.sh` 側の変更は不要（同じファイルを読み込むだけ）

## クエリ / ローダー変更（`pages/scriptures/$collection/$book/$chapter.tsx`）

- `queryVerseTexts` を `languages: string[]` を受け取る汎用シグネチャにする（`.in('language', languages)`）。呼び出し側で `bilingual` が false なら `['ja']`、true なら `['ja', SECONDARY_LANGUAGE]` を渡す
- 「日本語と一緒に出す2言語目」は `shared/config` 配下の定数 `SECONDARY_LANGUAGE = 'en'` に一元化する。将来ピッカーUIを足す際は、この定数を選択値に差し替えるだけで済む
- 取得した行は節ごとにグルーピングし、`Map<number, { ja?: string; secondary?: string }>` の形にしてからコンポーネントへ渡す（コンポーネント側の型変更を最小限にする）
- `ChapterSearch` / `loaderDeps` に `bilingual?: boolean` を追加し、既存の `verses`/`select`/`mode` と同様に URL 検索パラメータとして扱う（`?bilingual=1`）。SSR ローダーがこの値を見て言語配列を組み立てる
- `bilingual=false`（デフォルト）のときは従来通り日本語のみ1クエリ。英語行を余分に取得するのはONのときだけなので、通常閲覧時のクエリコストは変わらない

## UI / トグル・表示

### トグルボタン

`ChapterView` と `VerseView` のヘッダーアクション（`BookmarkButton` の隣）に日英切替ボタンを追加する。押すと `bilingual` 検索パラメータをON/OFFし、ローダーが再実行される。ON/OFF 状態は URL に載るのみで、DB や localStorage への永続化はしない（セッションやページ間で自動的に引き継がれることは意図しない — 各ページ表示時の一時的な表示設定）。

### レイアウト

- `VerseRow`（章一覧）・`ScriptureText`（単一節ビュー）の両方に `textHtmlSecondary?: string` / `secondaryLang?: string` を追加する（`textHtmlEn` のような言語決め打ちの名前にしない）
- 通常幅: 日本語テキストの下に第2言語テキストを縦に並べる（`flex-col`）
- `lg` 幅以上: `lg:flex-row` で左右2カラムに切替（節番号は日本語列の左に固定、レイアウトはブレークポイントで自動切替。JS判定は不要）
- 第2言語テキストは既存の `SanitizedVerseHtml` を再利用し、`<span lang={secondaryLang}>` でラップしてスクリーンリーダー・ブラウザの言語処理に正しい言語コードを伝える

### ナビゲーション時のパラメータ引き継ぎ

`VerseRow` 内の `Link` を `search={{ verses: [verse] }}` の静的オブジェクトから `search: (prev) => ({ ...prev, verses: [verse] })` に変更し、章一覧から単一節ビューへ移動しても `bilingual` の状態を保持する。

## テスト方針

TDD で進める（失敗テスト → 実装 → 通過）。

- `tests/shared/ui/ScriptureText.test.tsx`: `textHtmlSecondary` 指定時に第2言語テキストが `lang` 属性付きで描画されることを確認
- `tests/features/select-scripture-verses/VerseRow.test.tsx`: 同様に secondary テキストの描画、`lg` 幅クラス（2カラム）とデフォルト（縦並び）のクラス切替を確認
- `tests/pages/scriptures/chapter.test.tsx`: `bilingual` 検索パラメータで `queryVerseTexts` に渡る言語配列が `['ja']` / `['ja', 'en']` のどちらになるか、既存の `mode`/`select` パラメータのテストと同様に検証
- 新規トグルボタンコンポーネントのテスト: クリックで `bilingual` 検索パラメータがON/OFFすること

## ロールアウト手順

1. マイグレーション適用（`language` カラム追加、PK拡張）
2. ローカルで `node scripts/fetch-scriptures.mjs --lang=en` を実行し英語データを取得（既存の日本語取得と同様に中断再開可能、レート制限1req/秒で約26分）
3. `node scripts/export-verses-seed.mjs` で `seed-verses.sql` を再生成する（日英両方を含む形に更新される）
4. `bash scripts/db-reset.sh` で動作確認する
5. 本番 Supabase に対しても同じマイグレーションを適用後、`DATABASE_URL` を本番に向けて英語データ取得スクリプトを実行するか、更新済みの `seed-verses.sql` を本番DBに流し込む

## Out of Scope

- 言語選択ピッカーUI（表示する第2言語をユーザーが選ぶ機能）— アーキテクチャ上は `SECONDARY_LANGUAGE` 定数を差し替えるだけで対応できるが、UIとしては今回作らない
- 3言語以上の同時表示
- 日英以外の言語データの取得・投入（レジストリへのエントリ追加自体は今回のスクリプト変更で可能になるが、実際に英語以外のデータを取得するのは今回のスコープ外）
- 節テキストの全文検索の言語別対応
- 日英併記トグルの状態をユーザー設定として永続化すること（DB・localStorage）
