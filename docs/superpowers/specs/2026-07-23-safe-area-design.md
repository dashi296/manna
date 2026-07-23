# セーフエリア（notch / ホームインジケーター）対応 設計

**作成日:** 2026-07-23
**対象:** Manna PWA（Phase 1 継続改善）

## 背景と目的

`apps/pwa/src/pages/__root.tsx` の viewport meta には `viewport-fit=cover` が既に設定されているが、`env(safe-area-inset-*)` によるセーフエリア対応が一切実装されていない。

`viewport-fit=cover` はコンテンツを画面端（ノッチ・ホームインジケーター領域）まで拡張する指定であり、これ単体では固定要素がその領域に被る。iOS の standalone PWA（ホーム画面追加後に起動した状態）ではブラウザ chrome が無いため、特にノッチ付き・ホームインジケーター付き端末で下記の被りが起こり得る:

- `BottomNav`（下部固定ナビ）がホームインジケーターに被る
- `PageHeader`（上部 sticky ヘッダー）がノッチ / ステータスバー領域に被る

実機での不具合報告があったわけではなく、コードレビューで発見した未対応箇所への予防的対応。

## 対象範囲

モバイル幅（`lg:hidden` 相当）で画面端に接する固定・sticky要素、4箇所:

1. `shared/ui/BottomNav.tsx` — 下部固定ナビ
2. `shared/ui/PageHeader.tsx` の `stickyHeaderClassName` / `stickyHeaderStyle` パターン — 上部 sticky ヘッダー。以下2箇所で使われている:
   - `shared/ui/PageHeader.tsx` 自体（`px-4 py-3`）
   - `features/select-scripture-verses/ui/SelectionModeHeader.tsx`（`px-2 py-2`）
3. `shared/ui/InstallPwaBanner/InstallPwaBanner.tsx` — 下部固定バナー（`BottomNav` の直上に配置）
4. `pages/__root.tsx` の `<main>` — `BottomNav` との重なりを避けるための `pb-16`

`AppSidebar`（デスクトップ `lg:` 以上でのみ表示）はスコープ外。デスクトップはホームインジケーター/ノッチの影響を受けないため対応不要。

## 実装方針

`apps/pwa/src/styles.css` の `:root` に一元化した CSS 変数を追加する:

```css
:root {
  /* ...既存... */
  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
  --bottom-nav-h: calc(4rem + var(--safe-area-bottom));
}
```

`--bottom-nav-h` は「`BottomNav` の実際のレンダリング高さ」を表す一つの値として、`BottomNav` 自身・`main`・`InstallPwaBanner` の3箇所から参照する。こうすることで、将来 `BottomNav` の高さ（現在は `4rem` 相当）を変えても直す箇所が1つで済む。

### `BottomNav`

```tsx
<nav className="lg:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md border-t border-line bg-[var(--header-bg)] backdrop-blur-sm pb-[var(--safe-area-bottom)]">
```

`pb-[var(--safe-area-bottom)]` を追加することで、ナビ自体の高さがセーフエリア分だけ伸びる（アイコン・ラベルの位置は変わらず、下に余白が増える）。

### `main`（`__root.tsx`）

```tsx
<main className="flex-1 pb-[var(--bottom-nav-h)] lg:pb-0">
```

`pb-16`（固定 4rem）から `pb-[var(--bottom-nav-h)]` に変更。`BottomNav` の実際の高さに追従する。

### `InstallPwaBanner`

```tsx
<div
  role="region"
  aria-label="アプリのインストール案内"
  className="fixed inset-x-0 bottom-[var(--bottom-nav-h)] z-40 lg:hidden"
>
```

`bottom-16` から `bottom-[var(--bottom-nav-h)]` に変更。`BottomNav` の上に正しく積み上がる。

### `PageHeader` / `SelectionModeHeader`

`stickyHeaderStyle`（background/border/blur のみを持つオブジェクト）は変更しない。理由: `style` 属性は同名の CSS プロパティに対して Tailwind の class を常に上書きするため、`stickyHeaderStyle` に一律の `paddingTop` を足すと、`py-3`（`PageHeader`）・`py-2`（`SelectionModeHeader`）という消費側ごとに異なる基準の padding が両方とも同じ値に潰れてしまう。

そのため、safe-area 分の上余白は各消費側の className 側で「元の値 + セーフエリア」を明示する:

`shared/ui/PageHeader.tsx`:

```tsx
<header
  className={cn(stickyHeaderClassName, 'px-4 pt-[calc(0.75rem_+_var(--safe-area-top))] pb-3', className)}
  style={stickyHeaderStyle}
>
```

`features/select-scripture-verses/ui/SelectionModeHeader.tsx`:

```tsx
<header
  className={cn(stickyHeaderClassName, 'px-2 pt-[calc(0.5rem_+_var(--safe-area-top))] pb-2')}
  style={stickyHeaderStyle}
>
```

（`py-3` → `pt-[calc(0.75rem_+_var(--safe-area-top))] pb-3`、`py-2` → `pt-[calc(0.5rem_+_var(--safe-area-top))] pb-2` と読み替え）

CSS の `calc()` は `+`/`-` の前後に空白が必須（仕様上の制約）だが、Tailwind の任意値クラス名にはスペースを書けないため `_`（アンダースコア）でスペースを表す。`calc(0.75rem+var(...))`（アンダースコアなし）は無効な `calc()` として無視される。

## エラーハンドリング / エッジケース

- `env(safe-area-inset-*)` 未対応ブラウザ（Android Chrome 等）では `0px` にフォールバックする（`env()` の第2引数）ため、既存の見た目に影響しない
- Safari 以外のデスクトップブラウザやデスクトップ Chrome では通常 `env(safe-area-inset-bottom)` は `0px` なので `--bottom-nav-h` は実質 `4rem` のまま変わらない

## テスト

既存テストの class アサーションのパターン（`className.toContain(...)`）に合わせ、TDD で以下を追加してから実装する:

- `BottomNav.test.tsx`: nav 要素の className に `pb-[var(--safe-area-bottom)]` が含まれる
- `PageHeader.test.tsx`: header 要素の className に `pt-[calc(0.75rem_+_var(--safe-area-top))]` が含まれる
- `SelectionModeHeader.test.tsx`: header 要素の className に `pt-[calc(0.5rem_+_var(--safe-area-top))]` が含まれる
- `InstallPwaBanner.test.tsx`: バナー要素の className に `bottom-[var(--bottom-nav-h)]` が含まれる

`__root.tsx` の `main` は既存パターンとしてテストが書かれていないため、今回も対象外（`InstallPwaBanner.test.tsx` の設計時の前例に倣う）。

## スコープ外

- `AppSidebar`（デスクトップ）
- Android / デスクトップでの検証（`env()` が `0px` フォールバックするため実質差分なし）
- 左右のセーフエリア（`env(safe-area-inset-left/right)`）— 現状ランドスケープ表示を想定していないため対応しない

## Issue / PR

- Issue: 「セーフエリア（notch・ホームインジケーター）対応」を作成。背景・やることチェックリスト形式（既存 Issue #51 の形式を踏襲）
- PR: 本設計に基づく実装 + テストを、作成した Issue に紐付けて作成
