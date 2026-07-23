# セーフエリア対応 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iOS PWA (standalone) でノッチ・ホームインジケーターに固定/sticky UIが被らないよう、`env(safe-area-inset-*)` を使ったセーフエリア対応を実装する。

**Architecture:** `apps/pwa/src/styles.css` の `:root` に `--safe-area-top` / `--safe-area-bottom` / `--bottom-nav-h` の3つのCSS変数を定義し、下部固定ナビ（`BottomNav`）・上部sticky ヘッダー2種（`PageHeader` / `SelectionModeHeader`）・下部固定バナー（`InstallPwaBanner`）・メインコンテンツの下余白（`__root.tsx`）がそれらの変数を参照する。`--bottom-nav-h` を単一の真実の情報源にすることで、`BottomNav` の実高さ変更が他の依存箇所と食い違わないようにする。

**Tech Stack:** TanStack Start (React/TypeScript), Tailwind CSS v4（任意値クラス）, Vitest + @testing-library/react

**設計ドキュメント:** [`docs/superpowers/specs/2026-07-23-safe-area-design.md`](../specs/2026-07-23-safe-area-design.md)

## Global Constraints

- Tailwind 任意値クラスの `calc()` 内で `+`/`-` を使う場合、前後の空白を `_`（アンダースコア）で表現する（例: `calc(0.75rem_+_var(--safe-area-top))`）。空白なしの `calc(0.75rem+var(...))` は無効なCSSとして無視される
- `env(safe-area-inset-*)` は必ず第2引数のフォールバック（`0px`）付きで書く。未対応ブラウザ・デスクトップで既存の見た目を壊さないため
- 対象は `lg:hidden` のモバイル領域のみ。`AppSidebar`（デスクトップ）は対象外
- コンポーネントのテストは `apps/pwa/tests/` 配下の対応するファイルに追加する（新規ファイルは作らない）
- コメントは原則不要。WHYが自明でない場合のみ1行

---

### Task 1: GitHub Issue を作成する

**Files:** なし（GitHub上の操作のみ）

**Interfaces:**
- Produces: Issue番号（以降のタスクのコミットメッセージ・PR本文で `#<番号>` として参照する）

- [ ] **Step 1: Issue を作成する**

Run:
```bash
gh issue create \
  --title "セーフエリア（notch・ホームインジケーター）対応" \
  --body "$(cat <<'EOF'
## 背景

`viewport-fit=cover` は設定済みだが、`env(safe-area-inset-*)` によるセーフエリア対応が未実装。iOS の standalone PWA（ホーム画面追加後に起動した状態）ではブラウザ chrome が無いため、ノッチ付き・ホームインジケーター付き端末で下部固定ナビ・上部sticky ヘッダー・下部固定バナーが画面端に被る可能性がある。実機での不具合報告ではなく、コードレビューで発見した未対応箇所への予防的対応。

設計: `docs/superpowers/specs/2026-07-23-safe-area-design.md`

## やること

- [ ] `styles.css` に `--safe-area-top` / `--safe-area-bottom` / `--bottom-nav-h` のCSS変数を追加する
- [ ] `BottomNav`（下部固定ナビ）にセーフエリア分の下余白を追加する
- [ ] `PageHeader` / `SelectionModeHeader`（上部sticky ヘッダー）にセーフエリア分の上余白を追加する
- [ ] `InstallPwaBanner`（下部固定バナー）の位置を `BottomNav` の実高さに追従させる
- [ ] `__root.tsx` の `main` の下余白を `BottomNav` の実高さに追従させる
EOF
)"
```
Expected: `https://github.com/dashi296/manna/issues/<番号>` が標準出力に表示される。この番号を控えて以降のステップで使う（このプランでは `<ISSUE_NUMBER>` と表記する）。

---

### Task 2: CSS変数を追加する

**Files:**
- Modify: `apps/pwa/src/styles.css:58-86`（`:root` ブロック）

**Interfaces:**
- Produces: CSS変数 `--safe-area-top`, `--safe-area-bottom`, `--bottom-nav-h`（Task 3〜6 が参照する）

- [ ] **Step 1: フィーチャーブランチを作成する**

Run: `git checkout -b feature/safe-area-support`
Expected: `Switched to a new branch 'feature/safe-area-support'`

- [ ] **Step 2: `:root` ブロックにCSS変数を追加する**

`apps/pwa/src/styles.css` の `:root` ブロック内、`--sidebar-ring: var(--lagoon);` の直後（86行目の `}` の直前）に追加:

```css
  --sidebar-ring: var(--lagoon);
  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
  --bottom-nav-h: calc(4rem + var(--safe-area-bottom));
}
```

- [ ] **Step 3: 既存テストが壊れていないことを確認する**

Run: `pnpm --filter @manna/pwa test`
Expected: 既存の 39 ファイル / 200 テストが全て PASS（CSSの変更のみでロジック変更はないため）

- [ ] **Step 4: Commit**

```bash
git add apps/pwa/src/styles.css
git commit -m "feat: セーフエリア用CSS変数を追加

#<ISSUE_NUMBER>"
```

---

### Task 3: `BottomNav` にセーフエリア分の下余白を追加する

**Files:**
- Modify: `apps/pwa/src/shared/ui/BottomNav.tsx:9`
- Test: `apps/pwa/tests/shared/ui/BottomNav.test.tsx`

**Interfaces:**
- Consumes: CSS変数 `--safe-area-bottom`（Task 2）

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/shared/ui/BottomNav.test.tsx` の最後の `it` ブロックの後（`describe` の閉じ括弧の直前）に追加:

```tsx
  it('nav要素にセーフエリア分の下部余白クラスが付与される', () => {
    render(<BottomNav />)
    const nav = screen.getByRole('navigation')
    expect(nav.className).toContain('pb-[var(--safe-area-bottom)]')
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `pnpm --filter @manna/pwa test BottomNav`
Expected: FAIL — `expect(nav.className).toContain('pb-[var(--safe-area-bottom)]')` で不一致

- [ ] **Step 3: 実装する**

`apps/pwa/src/shared/ui/BottomNav.tsx:9` を変更:

```tsx
    <nav className="lg:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md border-t border-line bg-[var(--header-bg)] backdrop-blur-sm pb-[var(--safe-area-bottom)]">
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `pnpm --filter @manna/pwa test BottomNav`
Expected: PASS（既存テストも含め全て）

- [ ] **Step 5: Commit**

```bash
git add apps/pwa/src/shared/ui/BottomNav.tsx apps/pwa/tests/shared/ui/BottomNav.test.tsx
git commit -m "feat: BottomNavにセーフエリア分の下余白を追加

#<ISSUE_NUMBER>"
```

---

### Task 4: `PageHeader` にセーフエリア分の上余白を追加する

**Files:**
- Modify: `apps/pwa/src/shared/ui/PageHeader.tsx:24`
- Test: `apps/pwa/tests/shared/ui/PageHeader.test.tsx`

**Interfaces:**
- Consumes: CSS変数 `--safe-area-top`（Task 2）

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/shared/ui/PageHeader.test.tsx` の最後の `it` ブロックの後（`describe` の閉じ括弧の直前）に追加:

```tsx
  it('タイトルの上にセーフエリア分の上部パディングクラスが付与される', () => {
    render(<PageHeader title="テストページ" />)
    const heading = screen.getByRole('heading', { name: 'テストページ' })
    const header = heading.closest('header')
    expect(header?.className).toContain('pt-[calc(0.75rem_+_var(--safe-area-top))]')
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `pnpm --filter @manna/pwa test PageHeader`
Expected: FAIL — `header?.className` に `pt-[calc(0.75rem_+_var(--safe-area-top))]` が含まれない

- [ ] **Step 3: 実装する**

`apps/pwa/src/shared/ui/PageHeader.tsx:24` を変更（`py-3` を `pt-[calc(0.75rem_+_var(--safe-area-top))] pb-3` に置き換え）:

```tsx
      className={cn(stickyHeaderClassName, 'px-4 pt-[calc(0.75rem_+_var(--safe-area-top))] pb-3', className)}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `pnpm --filter @manna/pwa test PageHeader`
Expected: PASS（既存テストも含め全て）

- [ ] **Step 5: Commit**

```bash
git add apps/pwa/src/shared/ui/PageHeader.tsx apps/pwa/tests/shared/ui/PageHeader.test.tsx
git commit -m "feat: PageHeaderにセーフエリア分の上余白を追加

#<ISSUE_NUMBER>"
```

---

### Task 5: `SelectionModeHeader` にセーフエリア分の上余白を追加する

**Files:**
- Modify: `apps/pwa/src/features/select-scripture-verses/ui/SelectionModeHeader.tsx:17`
- Test: `apps/pwa/tests/features/select-scripture-verses/SelectionModeHeader.test.tsx`

**Interfaces:**
- Consumes: CSS変数 `--safe-area-top`（Task 2）

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/features/select-scripture-verses/SelectionModeHeader.test.tsx` の最後の `it` ブロックの後（`describe` の閉じ括弧の直前）に追加:

```tsx
  it('セーフエリア分の上部パディングクラスが付与される', () => {
    render(<SelectionModeHeader count={0} onCancel={vi.fn()} onSubmit={vi.fn()} />)
    const header = screen.getByRole('button', { name: '選択をキャンセル' }).closest('header')
    expect(header?.className).toContain('pt-[calc(0.5rem_+_var(--safe-area-top))]')
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `pnpm --filter @manna/pwa test SelectionModeHeader`
Expected: FAIL — `header?.className` に `pt-[calc(0.5rem_+_var(--safe-area-top))]` が含まれない

- [ ] **Step 3: 実装する**

`apps/pwa/src/features/select-scripture-verses/ui/SelectionModeHeader.tsx:17` を変更（`py-2` を `pt-[calc(0.5rem_+_var(--safe-area-top))] pb-2` に置き換え）:

```tsx
    <header className={cn(stickyHeaderClassName, 'px-2 pt-[calc(0.5rem_+_var(--safe-area-top))] pb-2')} style={stickyHeaderStyle}>
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `pnpm --filter @manna/pwa test SelectionModeHeader`
Expected: PASS（既存テストも含め全て）

- [ ] **Step 5: Commit**

```bash
git add apps/pwa/src/features/select-scripture-verses/ui/SelectionModeHeader.tsx apps/pwa/tests/features/select-scripture-verses/SelectionModeHeader.test.tsx
git commit -m "feat: SelectionModeHeaderにセーフエリア分の上余白を追加

#<ISSUE_NUMBER>"
```

---

### Task 6: `InstallPwaBanner` の位置を `BottomNav` の実高さに追従させる

**Files:**
- Modify: `apps/pwa/src/shared/ui/InstallPwaBanner/InstallPwaBanner.tsx:70-74`
- Test: `apps/pwa/tests/shared/ui/InstallPwaBanner.test.tsx`

**Interfaces:**
- Consumes: CSS変数 `--bottom-nav-h`（Task 2）

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/shared/ui/InstallPwaBanner.test.tsx` の最後の `it` ブロックの後（`describe` の閉じ括弧の直前）に追加:

```tsx
  it('BottomNavの実高さ分のオフセットクラスが付与される', () => {
    stubUa(IOS_SAFARI_UA)
    render(<InstallPwaBanner />)
    const banner = screen.getByRole('region', { name: BANNER_LABEL })
    expect(banner.className).toContain('bottom-[var(--bottom-nav-h)]')
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `pnpm --filter @manna/pwa test InstallPwaBanner`
Expected: FAIL — `banner.className` に `bottom-[var(--bottom-nav-h)]` が含まれない（現状は `bottom-16`）

- [ ] **Step 3: 実装する**

`apps/pwa/src/shared/ui/InstallPwaBanner/InstallPwaBanner.tsx:70-74` を変更:

```tsx
      <div
        role="region"
        aria-label="アプリのインストール案内"
        className="fixed inset-x-0 bottom-[var(--bottom-nav-h)] z-40 lg:hidden"
      >
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `pnpm --filter @manna/pwa test InstallPwaBanner`
Expected: PASS（既存テストも含め全て）

- [ ] **Step 5: Commit**

```bash
git add apps/pwa/src/shared/ui/InstallPwaBanner/InstallPwaBanner.tsx apps/pwa/tests/shared/ui/InstallPwaBanner.test.tsx
git commit -m "feat: InstallPwaBannerの位置をBottomNavの実高さに追従させる

#<ISSUE_NUMBER>"
```

---

### Task 7: `main` の下余白を `BottomNav` の実高さに追従させる

**Files:**
- Modify: `apps/pwa/src/pages/__root.tsx:95`

**Interfaces:**
- Consumes: CSS変数 `--bottom-nav-h`（Task 2）

このタスクには自動テストを追加しない（設計ドキュメント参照: `__root.tsx` は既存も含めテストが書かれていないパターン）。

- [ ] **Step 1: 実装する**

`apps/pwa/src/pages/__root.tsx:95` を変更:

```tsx
          <main className="flex-1 pb-[var(--bottom-nav-h)] lg:pb-0">
```

- [ ] **Step 2: 既存テストが壊れていないことを確認する**

Run: `pnpm --filter @manna/pwa test`
Expected: 全ファイル PASS

- [ ] **Step 3: Commit**

```bash
git add apps/pwa/src/pages/__root.tsx
git commit -m "feat: mainの下余白をBottomNavの実高さに追従させる

#<ISSUE_NUMBER>"
```

---

### Task 8: ビルド確認・push・PR作成

**Files:** なし（検証とGitHub操作のみ）

- [ ] **Step 1: ビルドが通ることを確認する**

Run: `pnpm --filter @manna/pwa build`
Expected: エラーなく完了（`dist/` に成果物が生成される）

- [ ] **Step 2: 全テストを再確認する**

Run: `pnpm --filter @manna/pwa test`
Expected: 全ファイル PASS（Task 2〜7 で追加した分を含め計 204 テスト）

- [ ] **Step 3: ブランチをpushする**

Run: `git push -u origin feature/safe-area-support`
Expected: リモートに `feature/safe-area-support` ブランチが作成される

- [ ] **Step 4: PRを作成する**

Run:
```bash
gh pr create \
  --title "セーフエリア（notch・ホームインジケーター）対応" \
  --body "$(cat <<'EOF'
## Summary
- `viewport-fit=cover` は設定済みだが未実装だった `env(safe-area-inset-*)` 対応を追加
- 下部固定ナビ（`BottomNav`）・上部sticky ヘッダー（`PageHeader` / `SelectionModeHeader`）・下部固定バナー（`InstallPwaBanner`）・メインコンテンツ下余白（`__root.tsx`）の4箇所にセーフエリアを反映
- `--bottom-nav-h` というCSS変数に `BottomNav` の実高さを一元化し、依存箇所（`main` / `InstallPwaBanner`）が追従するようにした

設計: `docs/superpowers/specs/2026-07-23-safe-area-design.md`

Closes #<ISSUE_NUMBER>

## Test plan
- [x] `pnpm --filter @manna/pwa test` 全PASS
- [x] `pnpm --filter @manna/pwa build` エラーなし
- [ ] レビュー後、実機（iPhone Safari standalone）での見た目確認

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Expected: PR URLが標準出力に表示される

---

## Self-Review Notes

- **Spec coverage:** 設計ドキュメントの4対象（BottomNav / PageHeader・SelectionModeHeaderのsticky headerパターン / InstallPwaBanner / main）は Task 3〜7 で網羅。Issue作成・PR作成も Task 1・8 でカバー
- **Placeholder scan:** `<ISSUE_NUMBER>` はTask 1完了後に実際の番号へ実行者が置き換える値（プレースホルダーではなく実行時に確定する値として明示）
- **Type consistency:** 各タスクで使うCSS変数名（`--safe-area-top` / `--safe-area-bottom` / `--bottom-nav-h`）はTask 2で定義したものと全タスクで一致することを確認済み
