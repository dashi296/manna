# 聖典本文の明朝体化 設計

- 日付: 2026-08-05
- ステータス: 設計承認済み・実装計画待ち

## 背景・目的

現在 `apps/pwa/src/styles.css` は欧文フォント（Manrope / Fraunces）のみを指定しており、日本語フォントの指定が一切ない。そのため聖典本文は OS 標準のゴシック体（macOS: ヒラギノ角ゴ、Windows: 游ゴシック）で表示され、「聖典を読んでいる」という体験に必要な書籍らしさが出ていない。

聖典本文に明朝体（Noto Serif JP）を適用し、読書体験としての質感を高める。

適用範囲は **聖典本文のみ**。ナビ・ボタン・投稿カードなどの UI と、ユーザーが書いた感想文は現行のゴシック体（Manrope + OS 標準）のままとする。UI 要素まで明朝体にすると可読性とモダンさが落ちるため、聖典を読む場面だけをコントラストとして際立たせる。

## フォント選定

**Noto Serif JP（Google Fonts CDN、weight 400 のみ）** を採用する。

### セルフホスト（Fontsource）を採用しない理由

TanStack Start には `next/font` 相当の仕組みがなく、Vite エコシステムでは Fontsource によるセルフホストが定石とされる。しかし日本語フォントでは逆効果になることを実測で確認した:

| 方式 | 実測値 |
|---|---|
| `@fontsource/noto-serif-jp@5.3.0` | japanese サブセットが**単一 1.3MB**（woff2 / weight 400）。`unicode-range` 指定なし → 表示時に丸ごとダウンロード |
| Google Fonts CSS2 API | **124個の `unicode-range` サブセット**に分割（1個あたり 6〜58KB）→ 表示中の文字を含むサブセットのみダウンロード。日本語本文で実効 200〜300KB 程度 |

欧文フォントではセルフホストが有利だが、日本語は Google 側の動的サブセット分割の恩恵が大きく上回る。

### weight を 400 のみとする理由

節テキストは `DOMPurify` の `ALLOWED_TAGS` が `ruby` / `rb` / `rt` に限定されており、強調タグ（`<strong>` / `<b>`）が通らない。太字表現が発生しないため 400 だけで足りる。

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

### 3. `apps/pwa/src/shared/ui/ScriptureText.tsx`

`SanitizedVerseHtml` の `className={className}` を `cn('font-scripture', className)` に変更する。

節テキスト描画の唯一の出口がこのコンポーネントであるため、ここ1箇所で以下の両方に適用される:

- 章表示（`ScriptureText` → `pages/scriptures/$collection/$book/$chapter.tsx`）
- 節選択リスト（`features/select-scripture-verses/ui/VerseRow.tsx`）

節番号（`ScriptureText` / `VerseRow` 内の別 `span`）は sans のまま影響を受けない。対訳の英語側も同じファミリになり、Noto Serif JP の欧文グリフ（Noto Serif 系）で和欧のトーンが揃う。

### 4. 文字サイズ・行間

**まず現状維持（`text-sm` / `leading-relaxed`）で実装する。**

明朝体はゴシック体より線が細く小さく見えるため調整が必要になる可能性があるが、判断は実物を見てから行う。実装後に `verify` スキルの手順（Supabase ローカル + Vite dev + Playwright MCP）でローカル起動し、章ページの以下2案のスクリーンショットを並べて比較して決定する:

- A: 据え置き（14px / `leading-relaxed`）
- B: 16px 相当 / 行高 1.9

同時にルビの見え方（`rt` は親の 50% サイズ）が潰れていないかを確認する。既存の `rt { transform: translateY(0.25em) }` の調整量が明朝体でも適切かも合わせて見る。

### 5. テスト

`tests/shared/ui/ScriptureText.test.tsx` に「節テキスト要素に `font-scripture` クラスが付与される」テストを追加する。TDD（失敗するテストを書く → 実装 → 通過）で進める。

`className` を渡した場合に `font-scripture` と併存すること（`cn` による結合）も検証する。

## 既知のトレードオフ

- **FOUT**: `display=swap` により、明朝体が到着するまで OS 標準ゴシック体で表示される。日本語は全角幅がほぼ揃うため CLS への影響は軽微と判断する
- **外部 CDN 依存**: Google Fonts への依存が残る。Cloudflare Workers にデプロイしているため、同一オリジン配信にはならない

## Out of Scope

- UI 要素（ナビ・ボタン・カード）およびユーザー投稿本文への明朝体適用
- 縦書き表示
- **自前サブセット化**: 聖典テキスト（`scripture_verses`）の使用文字だけを抽出して単一 woff2（推定 ~300KB）を生成し `public/` から同一オリジン配信する案。Google の動的サブセットとの差が小さい割にビルド工程が増えるため今回は見送る。外部依存を外したくなった時点で `scripts/` に生成スクリプトを追加する形で対応できる（Noto は OFL のためサブセット化・再配布は許容される）
