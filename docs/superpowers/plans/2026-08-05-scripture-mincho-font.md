# 聖典本文の明朝体化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 聖典の節テキストだけを明朝体（Noto Serif JP）で表示し、聖典を読む場面に書籍らしい質感を与える。

**Architecture:** Google Fonts の読み込みを `styles.css` の `@import` から root route の `head.links` へ移し、`preconnect` を添えて1ホップ短縮する。Tailwind v4 の `@theme inline` に `--font-scripture` を定義して `font-scripture` ユーティリティを生成し、節テキスト描画の唯一の出口である `SanitizedVerseHtml` の1箇所に適用する。これだけで章表示と節選択リストの両方に効く。

**Tech Stack:** TanStack Start / React 19 / TailwindCSS v4 (`@theme inline`) / Google Fonts CDN / Vitest + @testing-library/react

**Spec:** [`docs/superpowers/specs/2026-08-05-scripture-font-design.md`](../specs/2026-08-05-scripture-font-design.md) / セルフホスト移行は Issue #107

## Global Constraints

- FSD のインポート方向を守る（pages → widgets → features → entities → shared）。外部からは `index.ts` 経由
- コメントは原則不要。WHY が自明でない場合のみ1行で記載する
- UI は TDD（失敗するテスト → 実装 → 通過）で実装する
- テストは `apps/pwa/tests/` 下に、`src/` の構造をミラーして置く
- テストコマンドは `apps/pwa` ディレクトリで `pnpm test <パス>`。全件は同ディレクトリで `pnpm test`
- ベースラインは **303 テスト / 52 ファイル**がパスしている状態
- Noto Serif JP は **weight 400 のみ**読み込む。節テキストは `DOMPurify` の `ALLOWED_TAGS` が `ruby` / `rb` / `rt` に限定されており太字表現が発生しないため
- 明朝体を当てるのは節テキストのみ。節番号・UI・ユーザー投稿本文は現行のゴシック体のまま
- コミットメッセージは日本語。末尾に `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` を付ける

## File Structure

| ファイル | 役割 |
|---|---|
| `apps/pwa/src/styles.css` | 変更（2行目・8-10行目）。`@import` の削除と `--font-scripture` トークンの追加 |
| `apps/pwa/src/pages/__root.tsx` | 変更（33-39行目）。`links` に preconnect 2件と Google Fonts stylesheet を追加 |
| `apps/pwa/src/shared/ui/ScriptureText.tsx` | 変更（38行目）。`SanitizedVerseHtml` の wrapper に `font-scripture` を付与 |
| `apps/pwa/tests/shared/ui/ScriptureText.test.tsx` | 変更。明朝体クラスの付与・非付与を検証するテストを追加 |
| `apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx` | 変更。節選択リスト側にも明朝体が効くことを検証 |

**なぜ `SanitizedVerseHtml` の1箇所だけを変えるか:** 節テキストを描画する経路は `ScriptureText`（章表示）と `VerseRow`（節選択リスト）の2つあるが、どちらも最終的にこのコンポーネントを通る。`font-family` は継承プロパティのため、`useEffect` 内で `innerHTML` に後から挿入される `ruby` / `rb` / `rt` にも自動的に適用される。節番号は同階層の別 `span` なので影響を受けない。

---

### Task 1: フォント読み込みの移設とトークン定義

**Files:**
- Modify: `apps/pwa/src/styles.css:2`（`@import` 削除）, `apps/pwa/src/styles.css:8-10`（トークン追加）
- Modify: `apps/pwa/src/pages/__root.tsx:33-39`（`links` 配列）

**Interfaces:**
- Consumes: なし（このタスクが最初）
- Produces: `font-scripture` Tailwind ユーティリティ。Task 2 がこれを使う

このタスクにはユニットテストを書かない。Tailwind のユーティリティ生成と `<head>` への出力はコンポーネント単体テストでは検証できないため、開発サーバーが返す SSR HTML を直接確認する。

- [ ] **Step 1: `styles.css` の `@import` を削除する**

`apps/pwa/src/styles.css` の2行目を削除する。削除対象は次の1行:

```css
@import url("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap");
```

削除後、ファイルは `@import "tailwindcss";` から始まる（1行目の空行は残す）。

- [ ] **Step 2: `--font-scripture` トークンを追加する**

`apps/pwa/src/styles.css` の `@theme inline` ブロック内、`--font-display` の直後に1行足す:

```css
@theme inline {
  --font-sans: "Manrope", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Fraunces", Georgia, serif;
  --font-scripture: "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif;
```

Tailwind v4 は `--font-*` から `font-scripture` ユーティリティを自動生成する。CDN 到達不能時は OS 標準の明朝体にフォールバックする。

- [ ] **Step 3: `__root.tsx` の `links` に preconnect と stylesheet を追加する**

`apps/pwa/src/pages/__root.tsx` の `links` 配列を次の内容に置き換える。既存の manifest / icon の3行はそのまま残す:

```ts
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Manrope:wght@400;500;600;700;800&family=Noto+Serif+JP:wght@400&display=swap',
      },
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.json' },
      { rel: 'icon', href: '/logo-mark.svg', type: 'image/svg+xml' },
      { rel: 'alternate icon', href: '/favicon.ico' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    ],
```

`preconnect` を先頭に置くのは、`fonts.gstatic.com` への DNS 解決と TLS ハンドシェイクを woff2 取得前に済ませるため。`crossOrigin` は React DOM の props としてそのまま渡るためキャメルケースが正しい。

- [ ] **Step 4: 既存テストが全件通ることを確認する**

`apps/pwa` ディレクトリで実行:

```bash
pnpm test
```

Expected: `Test Files 52 passed (52)` / `Tests 303 passed (303)`

- [ ] **Step 5: 開発サーバーの SSR HTML に link が出力されることを確認する**

`verify` スキルの手順でローカル Supabase と Vite dev サーバーを起動したうえで、別ターミナルから実行:

```bash
curl -s http://localhost:3000/scriptures | grep -oE '<link[^>]*fonts\.(googleapis|gstatic)[^>]*>'
```

Expected: 3行出力される（`preconnect` 2件と `stylesheet` 1件）。stylesheet の href に `Noto+Serif+JP` が含まれていること。

`/scriptures` は認証不要のため、ログインせずに確認できる。

- [ ] **Step 6: コミット**

```bash
git add apps/pwa/src/styles.css apps/pwa/src/pages/__root.tsx
git commit -m "$(cat <<'EOF'
feat: Noto Serif JP を読み込み聖典用フォントトークンを追加

Google Fonts の読み込みを styles.css の @import から root route の
head.links へ移し、preconnect を添えてリクエストチェーンを1ホップ短縮する。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 節テキストへの明朝体適用

**Files:**
- Modify: `apps/pwa/src/shared/ui/ScriptureText.tsx:38`
- Test: `apps/pwa/tests/shared/ui/ScriptureText.test.tsx`（末尾に追加）
- Test: `apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx`（末尾に追加）

**Interfaces:**
- Consumes: Task 1 が定義した `font-scripture` ユーティリティ
- Produces: `SanitizedVerseHtml` が描画する `span` に `font-scripture` クラスが付く状態。Task 3 の目視確認がこれに依存する

**検証対象の注意:** テストで見るのは `SanitizedVerseHtml` が描画する本文 `span` の className であり、`ScriptureText` の `className` prop（外側 `div` に付く）とは別物である。

- [ ] **Step 1: 失敗するテストを書く（ScriptureText 側）**

`apps/pwa/tests/shared/ui/ScriptureText.test.tsx` の1行目の import に `SanitizedVerseHtml` を追加する:

```tsx
import { ScriptureText, SanitizedVerseHtml } from '@/shared/ui/ScriptureText'
```

そのうえで `describe('ScriptureText', ...)` の閉じ括弧の直前に4件を追加する:

```tsx
  it('本文に明朝体クラスを適用する', () => {
    const { container } = render(<ScriptureText verse={1} textHtml="テキスト" />)
    expect(container.querySelector('span.font-scripture')).not.toBeNull()
  })

  it('節番号には明朝体クラスを適用しない', () => {
    render(<ScriptureText verse={7} textHtml="テキスト" />)
    expect(screen.getByText('7').classList.contains('font-scripture')).toBe(false)
  })

  it('対訳表示では日本語・英語の両方に明朝体クラスを適用する', () => {
    const { container } = render(
      <ScriptureText
        verse={1}
        textHtml="日本語のテキスト"
        textHtmlSecondary="English text"
        secondaryLang="en"
      />
    )
    expect(container.querySelectorAll('span.font-scripture')).toHaveLength(2)
    expect(container.querySelector('[lang="en"]')?.classList.contains('font-scripture')).toBe(true)
  })

  it('SanitizedVerseHtml に渡した className と明朝体クラスが併存する', () => {
    const { container } = render(<SanitizedVerseHtml html="テキスト" className="lg:flex-1" />)
    const span = container.querySelector('span')
    expect(span?.classList.contains('font-scripture')).toBe(true)
    expect(span?.classList.contains('lg:flex-1')).toBe(true)
  })
```

- [ ] **Step 2: 失敗するテストを書く（VerseRow 側）**

`apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx` の `describe('VerseRow', ...)` の閉じ括弧の直前に1件を追加する。`VerseRow` は `Link` を使うためルーター配下でのレンダリングが必要で、同ファイルが定義済みの `renderInRouter` ヘルパーと `baseProps` をそのまま使う:

```tsx
  it('本文に明朝体クラスを適用する', async () => {
    const { container } = renderInRouter(
      <VerseRow {...baseProps} mode="read" selected={false} onSelect={vi.fn()} />,
    )
    await waitFor(() => {
      expect(container.querySelector('span.font-scripture')).not.toBeNull()
    })
  })
```

`waitFor` で待つのは、`SanitizedVerseHtml` が `useEffect` 内で本文を注入するため。`renderInRouter` / `baseProps` / `waitFor` / `vi` はすべて同ファイルで定義・import 済みのため追加の import は不要。

- [ ] **Step 3: テストが失敗することを確認する**

`apps/pwa` ディレクトリで実行:

```bash
pnpm test tests/shared/ui/ScriptureText.test.tsx tests/features/select-scripture-verses/VerseRow.test.tsx
```

Expected: 新規5件が FAIL（`expected null not to be null` など）。既存テストは PASS のまま。

- [ ] **Step 4: 実装する**

`apps/pwa/src/shared/ui/ScriptureText.tsx` の `SanitizedVerseHtml` の return を変更する。変更前:

```tsx
  return <span ref={ref} className={className} style={style} lang={lang} />
```

変更後:

```tsx
  return <span ref={ref} className={cn('font-scripture', className)} style={style} lang={lang} />
```

`cn` は同ファイル3行目で既に import 済みのため追加の import は不要。

- [ ] **Step 5: テストが通ることを確認する**

`apps/pwa` ディレクトリで実行:

```bash
pnpm test tests/shared/ui/ScriptureText.test.tsx tests/features/select-scripture-verses/VerseRow.test.tsx
```

Expected: すべて PASS

- [ ] **Step 6: 全件テストで回帰がないことを確認する**

```bash
pnpm test
```

Expected: `Tests 308 passed (308)`（ベースライン 303 + 新規5）

- [ ] **Step 7: コミット**

```bash
git add apps/pwa/src/shared/ui/ScriptureText.tsx apps/pwa/tests/shared/ui/ScriptureText.test.tsx apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx
git commit -m "$(cat <<'EOF'
feat: 聖典の節テキストを明朝体で表示する

節テキスト描画の唯一の出口である SanitizedVerseHtml に font-scripture を
付与し、章表示と節選択リストの両方に適用する。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 実機確認と文字サイズ・英語書体の決定

**Files:**
- Modify（判断次第）: `apps/pwa/src/shared/ui/ScriptureText.tsx:59`, `apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx:61,90`
- Modify（判断次第）: `apps/pwa/src/styles.css`, `apps/pwa/src/pages/__root.tsx`

**Interfaces:**
- Consumes: Task 2 で明朝体が適用された状態
- Produces: なし（最終タスク）

このタスクは判断を伴う。**ステップ4でユーザーに提示し、決定を待ってからステップ5以降に進むこと。**

- [ ] **Step 1: ローカル環境を起動する**

`verify` スキルの手順に従い、ローカル Supabase と Vite dev サーバーを起動する。節データが入っていない場合は `bash scripts/db-reset.sh` を先に実行する。

- [ ] **Step 2: 明朝体が実際に適用されていることを確認する**

Playwright MCP で章ページ（例: `http://localhost:3000/scriptures/bofm/1-ne/1`）を開き、ブラウザコンソールで実行:

```js
document.fonts.check('16px "Noto Serif JP"')
```

Expected: `true`。`false` の場合はフォントが読み込まれていないため、`<head>` の link とネットワークタブの woff2 リクエストを確認する。オフライン環境では読み込めないため、この確認はネットワーク接続下で行う。

- [ ] **Step 3: 比較用スクリーンショットを撮る**

以下3種のサンプルで、それぞれ現状（`text-sm` / `leading-relaxed`）のスクリーンショットを撮る:

1. 通常の節が続く章
2. ルビの多い節を含む章
3. 日英対訳表示（対訳トグルをオン）

続けて、Playwright MCP のコンソールから一時的にスタイルを当てて、サイズ変更案のスクリーンショットも撮る:

```js
document.querySelectorAll('.font-scripture').forEach(el => {
  el.parentElement.style.fontSize = '16px'
  el.parentElement.style.lineHeight = '1.9'
})
```

- [ ] **Step 4: 判断材料をユーザーに提示する**

以下2点をスクリーンショット付きで提示し、決定を仰ぐ:

1. **文字サイズ**: A（据え置き 14px / `leading-relaxed`）か B（16px / 行高 1.9）か
2. **対訳の英語側の書体**: A（Noto Serif JP のラテングリフ・追加ロードなし）か B（欧文専用 Noto Serif・+14.4KB）か

あわせて、ルビ（`rt`）が潰れていないか、既存の `rt { transform: translateY(0.25em) }` の調整量が明朝体でも適切かの所見を添える。

- [ ] **Step 5: 文字サイズで B が選ばれた場合のみ適用する**

`apps/pwa/src/shared/ui/ScriptureText.tsx` の59行目:

```tsx
    <div className={cn('flex gap-2 py-2 text-sm leading-relaxed', className)}>
```

を次に変更する:

```tsx
    <div className={cn('flex gap-2 py-2 text-base leading-[1.9]', className)}>
```

`apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx` の本文側 `text-sm`（61行目付近の `primaryText` と、90行目付近の二次言語 `SanitizedVerseHtml`）を `text-base` に変更する。節番号の `text-xs` はそのままにする。

A が選ばれた場合はこのステップをスキップする。

- [ ] **Step 6: 英語書体で B が選ばれた場合のみ適用する**

`apps/pwa/src/pages/__root.tsx` の Google Fonts URL に `&family=Noto+Serif:wght@400` を追加する。

`apps/pwa/src/styles.css` の `:root` ブロックに変数を追加する（`@theme inline` ではなくここに置くのは、ユーティリティではなく属性セレクタから参照するため）:

```css
  --font-scripture-latin: "Noto Serif", Georgia, serif;
```

同ファイルの `rt` ルールの近くに次を追加する:

```css
.font-scripture[lang="en"] {
  font-family: var(--font-scripture-latin);
}
```

A が選ばれた場合はこのステップをスキップする。

- [ ] **Step 7: 変更を適用した場合はテストを再実行する**

ステップ5または6を実行した場合、`apps/pwa` ディレクトリで:

```bash
pnpm test
```

Expected: `Tests 308 passed (308)`

どちらもスキップした場合はこのステップも不要。

- [ ] **Step 8: 変更があればコミット**

```bash
git add -A apps/pwa/src
git commit -m "$(cat <<'EOF'
style: 聖典本文の文字サイズと英語書体を調整する

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

ステップ5・6の両方をスキップした場合はコミット不要。

- [ ] **Step 9: 実装後の記録を spec に残す**

`docs/superpowers/specs/2026-08-05-scripture-font-design.md` の項目4に、決定した内容（サイズ A/B、英語書体 A/B、ルビの所見）を1〜2文で追記してコミットする。
