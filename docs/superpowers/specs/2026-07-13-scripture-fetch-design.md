# 聖典テキスト取得スクリプト設計

## 概要

教会公式サイトのAPI (`churchofjesuschrist.org/study/api/v3`) から全聖典テキスト（日本語）を取得し、ローカルSupabaseの `scripture_verses` テーブルに保存する。

## APIエンドポイント

```
GET https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content
  ?lang=jpn
  &uri=/scriptures/{collection}/{book}/{chapter}
```

- レスポンス: JSON (`content.body` にHTML)
- 節データ: `<p class="verse" id="pN">` タグ内
- ルビ: `<ruby><rb>漢字</rb><rt>よみ</rt></ruby>`
- 脚注: `<a class="study-note-ref">` (除去対象)

## DBスキーマ

```sql
CREATE TABLE scripture_verses (
  collection_id text NOT NULL,
  book_id text NOT NULL,
  chapter integer NOT NULL,
  verse integer NOT NULL,
  text text NOT NULL,       -- プレーンテキスト（検索用）
  text_html text NOT NULL,  -- ルビ付きHTML（リッチ表示用）
  PRIMARY KEY (collection_id, book_id, chapter, verse),
  FOREIGN KEY (collection_id, book_id)
    REFERENCES scripture_books(collection_id, id) ON DELETE CASCADE
);
```

- RLS: 全ユーザーSELECT可（聖典は公開データ）
- GINインデックス: `text` カラムに全文検索用インデックスを追加

## 取得スクリプト

**ファイル**: `scripts/fetch-scriptures.mjs`

### 処理フロー

1. `scriptures.json` を読み込み、全コレクション/書/章のリストを構築
2. DBから取得済み章を問い合わせ、スキップリストを作成（中断再開対応）
3. 未取得の章について順次APIを叩く
4. HTMLをパースし、節ごとにプレーンテキスト + ルビ付きHTMLを抽出
5. Supabaseにバッチ INSERT

### レート制限

- 1リクエスト/秒（1,000ms間隔）
- 約1,582章 × 1秒 = 約26分（初回フル取得時）

### HTMLパース

```
入力: <p class="verse" id="p3">
        <span class="verse-number">3</span>
        わたしは、<ruby><rb>自</rb><rt>じ</rt></ruby><ruby><rb>分</rb><rt>ぶん</rt></ruby>の
        <a class="study-note-ref" href="#note3_a"><sup class="marker">...</sup>記録</a>が...
      </p>

text_html出力: わたしは、<ruby><rb>自</rb><rt>じ</rt></ruby><ruby><rb>分</rb><rt>ぶん</rt></ruby>の記録が...
text出力:      わたしは、自分の記録が...
```

- `<span class="verse-number">` を除去
- `<a class="study-note-ref">` のタグを除去し内部テキストのみ残す
- `<sup class="marker">` を除去
- `text_html`: `<ruby>` タグのみ残す
- `text`: 全HTMLタグを除去

### 中断再開

- 各章の INSERT 成功後にログ出力
- 再実行時、DBに存在する `(collection_id, book_id, chapter)` の組み合わせをスキップ
- ネットワークエラー時は3回リトライ（指数バックオフ）

### 進捗表示

```
[1/1582] bofm/1-ne/1 ... 20 verses
[2/1582] bofm/1-ne/2 ... 24 verses
...
[1582/1582] nt/rev/22 ... 21 verses
Done: 31,102 verses inserted
```

## 対象データ量

| コレクション | 書数 | 章数 |
|---|---|---|
| モルモン書 | 15 | 239 |
| 教義と聖約 | 1 | 138 |
| 高価な真珠 | 5 | 16 |
| 旧約聖書 | 39 | 929 |
| 新約聖書 | 27 | 260 |
| **合計** | **87** | **1,582** |
