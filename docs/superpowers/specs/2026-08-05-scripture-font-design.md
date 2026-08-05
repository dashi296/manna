# 聖典本文の明朝体化 設計

- 日付: 2026-08-05
- ステータス: 設計承認済み・実装計画待ち

## 背景・目的

現在 `apps/pwa/src/styles.css` は欧文フォント（Manrope / Fraunces）のみを指定しており、日本語フォントの指定が一切ない。そのため聖典本文は OS 標準のゴシック体（macOS: ヒラギノ角ゴ、Windows: 游ゴシック）で表示され、「聖典を読んでいる」という体験に必要な書籍らしさが出ていない。

聖典本文に明朝体（Noto Serif JP）を適用し、読書体験としての質感を高める。

適用範囲は **聖典本文のみ**。ナビ・ボタン・投稿カードなどの UI と、ユーザーが書いた感想文は現行のゴシック体（Manrope + OS 標準）のままとする。UI 要素まで明朝体にすると可読性とモダンさが落ちるため、聖典を読む場面だけをコントラストとして際立たせる。

## フォント選定

**Noto Serif JP（weight 400 のみ）** を **Google Fonts CDN** から配信する。

### weight を 400 のみとする理由

節テキストは `DOMPurify` の `ALLOWED_TAGS` が `ruby` / `rb` / `rt` に限定されており、強調タグ（`<strong>` / `<b>`）が通らない。太字表現が発生しないため 400 だけで足りる。

### 配信方式の比較

初回転送量は Google Fonts CDN とセルフホスト（Fontsource）で**同等**である。両者とも同じ 124 分割の `unicode-range` サブセット方式を採用しており、ブラウザは表示中の文字を含むサブセットのみを取得する。

`@fontsource/noto-serif-jp@5.3.0` の実測（2026-08-05）:

| CSS | `@font-face` | `unicode-range` | 実ファイル |
|---|---|---|---|
| `400.css`（標準・推奨） | 124 | 124 | woff2 120個 / 合計 5.1MB |
| `japanese-400.css`（個別サブセット・Fontsource が非推奨） | 1 | なし | 単一 1.3MB |
| Google Fonts CSS2 API | 124 | 124 | CDN 配信 |

転送量が同等であるため、**今回は実装が最小で済む Google Fonts CDN を選ぶ**。`__root.tsx` の `links` に数行足すだけで完結し、ビルド出力も増えない。

セルフホストには接続コストの削減・障害耐性・バージョン固定・第三者送信の排除といった利点があるが、ビルド出力に約240ファイル・10MB前後が乗る。この移行は issue #107 で追跡する。

なお Google Fonts の `unicode-range` 分割は「ページ本文に応じてサーバーが毎回生成する動的サブセット」ではない。Google は User-Agent に応じた CSS を返し、その CSS 内の `unicode-range` に基づいてブラウザが必要なフォントファイルを選ぶ。`text=` パラメータによるサーバーサイドのテキストサブセット化とは別の仕組みである。

「124分割」「実効 200〜300KB」は 2026-08-05 時点の実測値であり、Google 側の更新で変わり得る。

## 読み込み方式

`styles.css` 内の `@import url(...)` をやめ、root route の `head.links` に移す。

### 変更前（直列 4 ホップ）

```
HTML → styles.css → fonts CSS → woff2
```

`@import` は CSS がパースされてから初めてフォント CSS の取得が始まるため、リクエストチェーンが直列になる。

### 変更後（並列 3 ホップ + 接続確立済み）

```
HTML → [styles.css ∥ fonts CSS] → woff2
```

`preconnect` により `fonts.gstatic.com` への DNS 解決・TLS ハンドシェイクを woff2 取得前に済ませておく。

欧文フォントのみなら誤差の範囲だったが、日本語フォントは転送量が1桁大きいため、この1ホップ短縮と接続の先行確立が体感に効く。

## 実装

### 1. `apps/pwa/src/styles.css`

L2 の `@import url("https://fonts.googleapis.com/css2?family=Fraunces:...&family=Manrope:...")` を削除する。

`@theme inline` に聖典用トークンを追加する:

```css
--font-scripture: "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif;
```

Tailwind v4 は `@theme` の `--font-*` から `font-scripture` ユーティリティを自動生成する。CDN 到達不能時やオフライン時は OS 標準の明朝体にフォールバックする。

`inline` は必須ではない（値が他の custom property を参照していないため plain `@theme` でも同じユーティリティが生成される）が、既存の `--font-sans` / `--font-display` と同じブロックに揃える。`inline` ではフォントスタックがユーティリティに直接埋め込まれるため、`--font-scripture` を runtime に上書きすることはできない。今回は固定ユーティリティとして扱うため問題にならない。

### 2. `apps/pwa/src/pages/__root.tsx`

`head()` の `links` 配列を以下の順序にする:

```ts
links: [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Manrope:wght@400;500;600;700;800&family=Noto+Serif+JP:wght@400&display=swap',
  },
  { rel: 'stylesheet', href: appCss },
  // 以降は既存のまま（manifest / icon / apple-touch-icon）
]
```

3ファミリを1リクエストに統合する。`preconnect` は接続確立を先行させるため配列の先頭に置く。

link 属性は React DOM の props としてそのまま渡されるため、`crossOrigin` のキャメルケース表記が正しい。

なお React 19 は stylesheet を `precedence` 付きリソースとして管理するため、SSR が出力する生 HTML のタグ順が配列順と物理的に一致することを前提にはしない。両 stylesheet は同じ precedence であり、`@font-face` と `font-scripture` の間にカスケード順の依存もないため実害はない。

### 3. `apps/pwa/src/shared/ui/ScriptureText.tsx`

`SanitizedVerseHtml` の `className={className}` を `cn('font-scripture', className)` に変更する。

節テキスト描画の唯一の出口がこのコンポーネントであるため、ここ1箇所で以下の両方に適用される:

- 章表示（`ScriptureText` → `pages/scriptures/$collection/$book/$chapter.tsx`）
- 節選択リスト（`features/select-scripture-verses/ui/VerseRow.tsx`）

節番号（`ScriptureText` / `VerseRow` 内の別 `span`）は sans のまま影響を受けない。`font-family` は継承プロパティのため、`innerHTML` で後から挿入される `ruby` / `rb` / `rt` にも適用される。

対訳の英語側も同じファミリとなり、Noto Serif JP に含まれるラテングリフ（latin サブセット 18.7KB）で表示される。CJK フォントのラテン部分は和文との混植を前提に設計されているため、欧文専用書体とは字形・字幅が異なる。英語聖典は独立したブロックとして読むため専用の Noto Serif（latin サブセット 14.4KB）を当てる選択肢もあるが、差が実物を見ないと判断できないため項目4で比較する。

`cn` は内部で `tailwind-merge` を使うため、呼び出し元が `className` に別の font-family ユーティリティ（`font-sans` など）を渡した場合はそちらが優先される。**この上書きは許容する**（呼び出し元が明示的に指定した場合のみ発生し、現状そのような呼び出し元は存在しない）。

### 4. 文字サイズ・行間

**まず現状維持（`text-sm` / `leading-relaxed`）で実装する。**

明朝体はゴシック体より線が細く小さく見えるため調整が必要になる可能性があるが、判断は実物を見てから行う。実装後に `verify` スキルの手順（Supabase ローカル + Vite dev + Playwright MCP）でローカル起動し、章ページの以下2案のスクリーンショットを並べて比較して決定する:

- A: 据え置き（14px / `leading-relaxed`）
- B: 16px 相当 / 行高 1.9

比較に使うサンプルは、通常の節・ルビの多い節・日英対訳表示の3種とする。同時にルビの見え方（`rt` は UA スタイルシートにより親の約50%サイズ）が潰れていないか、既存の `rt { transform: translateY(0.25em) }` の調整量が明朝体でも適切かを確認する。

**対訳の英語側の書体もここで判断する。** 日英対訳のスクリーンショットで以下2案を比較する:

- A: Noto Serif JP のラテングリフ（追加ロードなし）
- B: 欧文専用の Noto Serif を `[lang="en"]` に指定（+14.4KB）

B を採る場合は `--font-scripture-latin` トークンを追加し、`SanitizedVerseHtml` が `lang` を受け取っている既存の仕組み（`secondaryLang`）を使って CSS で切り分ける。

### 5. テスト

`tests/shared/ui/ScriptureText.test.tsx` に以下を追加する。TDD（失敗するテストを書く → 実装 → 通過）で進める。

- `SanitizedVerseHtml` が描画する本文 `span` に `font-scripture` クラスが付与されること
- `SanitizedVerseHtml` に `className` を渡した場合に `font-scripture` と併存すること

検証対象は `SanitizedVerseHtml` の `className`（本文 `span`）であり、`ScriptureText` の `className` prop（外側 `div` に付く）とは別物である点に注意する。

ユニットテストで確認できるのはクラス付与までで、Tailwind がユーティリティを実際に生成したこと・head にフォント CSS が出力されること・Noto Serif JP がロードされたことは保証しない。これらは実装後の目視確認（項目4）でカバーする。

## 既知のトレードオフ

- **FOUT**: `display=swap` により、明朝体が到着するまで OS 標準ゴシック体で表示される。CLS への影響は句読点・欧文混在・ルビのはみ出し・フォント間の vertical metrics の差によって生じ得るため、断定せず項目4の目視確認で実際の挙動を見る
- **本文は SSR HTML に含まれない**: `SanitizedVerseHtml` は `useEffect` 内で `innerHTML` に注入するクライアント専用実装のため、日本語グリフの woff2 リクエストはフォント CSS の取得完了だけでなく hydration 完了後に開始される。低速回線では明朝体への切り替わりが体感できる程度に遅れる可能性がある
- **CDN 障害時**: フォント stylesheet は render-blocking リソースであるため、`fonts.googleapis.com` が遅延・タイムアウトした場合は即座に OS フォントへフォールバックするとは限らない。既存の `@import` 方式にも同じ性質があり、今回新たに生じるリスクではない
- **オフライン**: `apps/pwa/public/sw.js` は `install` / `activate` のみで `fetch` ハンドラを持たないため、フォントを一切キャッシュしない。オフライン時の表示可否はブラウザの HTTP キャッシュ次第であり保証されない。オフライン環境での目視確認では明朝体を確認できない
- **第三者送信**: 外部リクエストにより利用者の IP アドレス・User-Agent・Referrer が Google に送られる。本アプリの利用者層と現時点のプライバシー方針において**これを許容する**と判断する。排除が必要になった場合は issue #107 のセルフホスト移行で対応する
- **CSP**: 現在リポジトリ内に CSP 設定はない。将来導入する場合は `style-src` に `https://fonts.googleapis.com`、`font-src` に `https://fonts.gstatic.com` が必要になる

## Out of Scope

- UI 要素（ナビ・ボタン・カード）およびユーザー投稿本文への明朝体適用
- 縦書き表示
- **セルフホスト（Fontsource）への移行**: 転送量は同等だがビルド出力が約240ファイル・10MB前後増えるため今回は見送る。issue #107 で追跡
- **自前サブセット化**: `scripture_verses` の使用文字だけを抽出して単一 woff2 を生成する案。Fontsource / Google Fonts の `unicode-range` 分割との差が小さい割にビルド工程が増えるため見送る
- **Service Worker によるフォントキャッシュ**: オフラインでの聖典閲覧を要件に含める段階で別途検討する
- `display: swap` 以外（`optional` / `fallback`）の比較: 明朝体を確実に最終表示させる方針のため `swap` を選ぶ
