# インライン投稿コンポーザー UI 再考 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 章ビューを `read` / `select` の明示的モード切替に再構成し、投稿導線をヘッダー右の「投稿」ボタン + メニューに一本化する。

**Architecture:** 章ページ (`$chapter.tsx`) の内部状態として `mode: 'read' | 'select'` を導入し、URL search `?mode=select&select=...` と同期。モードに応じて `PageHeader` / `SelectionModeHeader` を切り替え、節行を `VerseRow` で描画する。投稿ボタンは `ComposeMenu`（モバイル: Sheet / デスクトップ: Popover）で「章全体」「節を選ぶ」の 2 択メニューを提示。

**Tech Stack:** React 19 + TanStack Start / Vite / TypeScript / Base UI (Dialog, Popover) / TailwindCSS v4 / Vitest + @testing-library/react

## Global Constraints

- FSD レイヤー順守: `widgets → features → entities → shared`（上位層 → 下位層のみ）
- 新規 FSD スライスは必ず `index.ts` で公開 API を提供
- shadcn/ui は Base UI 版へ移行中。新規プリミティブは `@base-ui/react` を使用
- コンポーネントテストは `apps/pwa/tests/` 配下に配置
- 変更ファイルパスはすべて `apps/pwa/` プレフィックス付きで指定
- TDD: 失敗テスト → 最小実装 → 通過 → コミット
- コメントは原則不要。WHY が自明でない場合のみ 1 行で記載
- 装飾用アイコンは `aria-hidden="true"` を付ける
- CSS 変数: `--lagoon`（アクセント）/ `--sea-ink`（本文色）/ `--sea-ink-soft`（薄い本文色）/ `--line`（ボーダー）/ `--chip-bg`（選択背景）/ `--chip-line`（チップ枠）/ `--palm`（バッジ色）/ `--header-bg`（ヘッダー背景）/ `--lagoon-deep`（リンク色）を用いる
- 元設計との整合: [`2026-07-18-inline-post-composer-ui-refinement-design.md`](../specs/2026-07-18-inline-post-composer-ui-refinement-design.md)

## ファイル構成

**新規:**
- `src/features/select-scripture-verses/ui/SelectionModeHeader.tsx` — 選択モード時のヘッダー
- `src/features/select-scripture-verses/ui/VerseRow.tsx` — 節行（`read` / `select` 兼用）
- `src/shared/ui/popover.tsx` — Base UI Popover ラッパー
- `src/widgets/compose-menu/ui/ComposeMenu.tsx` — 投稿ボタン + メニュー
- `src/widgets/compose-menu/index.ts` — Public API
- `tests/features/select-scripture-verses/SelectionModeHeader.test.tsx`
- `tests/features/select-scripture-verses/VerseRow.test.tsx`
- `tests/widgets/compose-menu/ComposeMenu.test.tsx`

**改修:**
- `src/features/select-scripture-verses/model/useVerseSelection.ts` — `parseMode` 追加
- `src/features/select-scripture-verses/index.ts` — export 更新
- `src/pages/scriptures/$collection/$book/$chapter.tsx` — モード切替統合
- `tests/features/select-scripture-verses/verseSelection.test.ts` — `parseMode` テスト追加

**削除:**
- `src/features/select-scripture-verses/ui/SelectionBar.tsx`
- `src/features/select-scripture-verses/ui/VerseCheckbox.tsx`
- `tests/features/select-scripture-verses/SelectionBar.test.tsx`
- `tests/features/select-scripture-verses/VerseCheckbox.test.tsx`

---

## Task 1: `parseMode` ヘルパーと URL パラメータ拡張の準備

**Files:**
- Modify: `apps/pwa/src/features/select-scripture-verses/model/useVerseSelection.ts`
- Modify: `apps/pwa/src/features/select-scripture-verses/index.ts`
- Modify: `apps/pwa/tests/features/select-scripture-verses/verseSelection.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `type SelectionMode = 'read' | 'select'`
  - `parseMode(input: unknown): SelectionMode`

### Steps

- [ ] **Step 1: 失敗テストを追加**

`apps/pwa/tests/features/select-scripture-verses/verseSelection.test.ts` の末尾に以下を追記:

```typescript
import { parseMode } from '@/features/select-scripture-verses'

describe('parseMode', () => {
  it("'select' を渡すと 'select' を返す", () => {
    expect(parseMode('select')).toBe('select')
  })

  it("undefined は 'read' にフォールバック", () => {
    expect(parseMode(undefined)).toBe('read')
  })

  it("不正な値は 'read' にフォールバック", () => {
    expect(parseMode('foo')).toBe('read')
    expect(parseMode(42)).toBe('read')
    expect(parseMode(null)).toBe('read')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd apps/pwa && pnpm vitest run tests/features/select-scripture-verses/verseSelection.test.ts`

Expected: FAIL（`parseMode` が未定義）

- [ ] **Step 3: `parseMode` を実装**

`apps/pwa/src/features/select-scripture-verses/model/useVerseSelection.ts` の末尾に追記:

```typescript
export type SelectionMode = 'read' | 'select'

export function parseMode(input: unknown): SelectionMode {
  return input === 'select' ? 'select' : 'read'
}
```

- [ ] **Step 4: `index.ts` から export**

`apps/pwa/src/features/select-scripture-verses/index.ts` を以下に更新:

```typescript
export { VerseCheckbox } from './ui/VerseCheckbox'
export { SelectionBar } from './ui/SelectionBar'
export {
  parseSelection,
  toggleVerse,
  formatSelectionLabel,
  parseMode,
  type SelectionMode,
} from './model/useVerseSelection'
```

- [ ] **Step 5: テストの通過を確認**

Run: `cd apps/pwa && pnpm vitest run tests/features/select-scripture-verses/verseSelection.test.ts`

Expected: PASS（全 12 テスト）

- [ ] **Step 6: 型検査を通す**

Run: `cd apps/pwa && pnpm typecheck`

Expected: エラー無し

- [ ] **Step 7: コミット**

```bash
git add apps/pwa/src/features/select-scripture-verses/model/useVerseSelection.ts \
        apps/pwa/src/features/select-scripture-verses/index.ts \
        apps/pwa/tests/features/select-scripture-verses/verseSelection.test.ts
git commit -m "feat(select-verses): parseMode ヘルパーで 'read' | 'select' モードを URL 同期可能にする"
```

---

## Task 2: `SelectionModeHeader` コンポーネント

**Files:**
- Create: `apps/pwa/src/features/select-scripture-verses/ui/SelectionModeHeader.tsx`
- Create: `apps/pwa/tests/features/select-scripture-verses/SelectionModeHeader.test.tsx`

**Interfaces:**
- Consumes: `Button` from `@/shared/ui/button`
- Produces:
  - `<SelectionModeHeader count={number} onCancel={() => void} onSubmit={() => void} />`

### Steps

- [ ] **Step 1: 失敗テストを追加**

`apps/pwa/tests/features/select-scripture-verses/SelectionModeHeader.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SelectionModeHeader } from '@/features/select-scripture-verses/ui/SelectionModeHeader'

describe('SelectionModeHeader', () => {
  it('count=0 で「節を選んでください」を表示し、投稿ボタンが disabled', () => {
    render(<SelectionModeHeader count={0} onCancel={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByText('節を選んでください')).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: /節を選択してから投稿できます/ })
    expect(submit).toBeDisabled()
  })

  it('count=3 で「3節選択中」を表示し、投稿ボタンが有効', () => {
    render(<SelectionModeHeader count={3} onCancel={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByText('3節選択中')).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: /3節に投稿/ })
    expect(submit).not.toBeDisabled()
  })

  it('キャンセルをクリックで onCancel が呼ばれる', async () => {
    const onCancel = vi.fn()
    render(<SelectionModeHeader count={2} onCancel={onCancel} onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '選択をキャンセル' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('投稿をクリックで onSubmit が呼ばれる', async () => {
    const onSubmit = vi.fn()
    render(<SelectionModeHeader count={2} onCancel={vi.fn()} onSubmit={onSubmit} />)
    await userEvent.click(screen.getByRole('button', { name: /2節に投稿/ }))
    expect(onSubmit).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd apps/pwa && pnpm vitest run tests/features/select-scripture-verses/SelectionModeHeader.test.tsx`

Expected: FAIL（`SelectionModeHeader` が未定義）

- [ ] **Step 3: 実装**

`apps/pwa/src/features/select-scripture-verses/ui/SelectionModeHeader.tsx`:

```tsx
import { PenLine, X } from 'lucide-react'
import { Button } from '@/shared/ui/button'

type Props = {
  count: number
  onCancel: () => void
  onSubmit: () => void
}

export function SelectionModeHeader({ count, onCancel, onSubmit }: Props) {
  const submitLabel = count === 0 ? '節を選択してから投稿できます' : `${count}節に投稿`
  const titleLabel = count === 0 ? '節を選んでください' : `${count}節選択中`

  return (
    <header
      className="sticky top-0 z-10 px-2 py-2 flex items-center gap-2"
      style={{
        background: 'var(--header-bg)',
        borderBottom: '1px solid var(--line)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onCancel}
        aria-label="選択をキャンセル"
        className="shrink-0 gap-1"
      >
        <X size={16} aria-hidden="true" />
        <span className="text-sm">キャンセル</span>
      </Button>
      <h1
        className="flex-1 text-center text-sm font-semibold truncate"
        style={{ color: 'var(--sea-ink)' }}
      >
        {titleLabel}
      </h1>
      <Button
        size="sm"
        onClick={onSubmit}
        disabled={count === 0}
        aria-label={submitLabel}
        className="shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold gap-1"
        style={
          count > 0
            ? { background: 'var(--lagoon)', color: '#fff' }
            : undefined
        }
      >
        <PenLine size={12} aria-hidden="true" />
        <span>投稿 ({count})</span>
      </Button>
    </header>
  )
}
```

- [ ] **Step 4: テストの通過を確認**

Run: `cd apps/pwa && pnpm vitest run tests/features/select-scripture-verses/SelectionModeHeader.test.tsx`

Expected: PASS（4 テスト）

- [ ] **Step 5: コミット**

```bash
git add apps/pwa/src/features/select-scripture-verses/ui/SelectionModeHeader.tsx \
        apps/pwa/tests/features/select-scripture-verses/SelectionModeHeader.test.tsx
git commit -m "feat(select-verses): SelectionModeHeader を追加"
```

---

## Task 3: `VerseRow` コンポーネント

**Files:**
- Create: `apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx`
- Create: `apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx`

**Interfaces:**
- Consumes:
  - `Link` from `@tanstack/react-router`
  - `SanitizedVerseHtml` from `@/shared/ui`
- Produces:
  - `<VerseRow collection={string} book={string} chapter={number} verse={number} textHtml={string|undefined} count={number} mode={'read'|'select'} selected={boolean} onSelect={(v: number) => void} />`

### Steps

- [ ] **Step 1: 失敗テストを追加**

`apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { VerseRow } from '@/features/select-scripture-verses/ui/VerseRow'

function renderInRouter(ui: React.ReactNode) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <>{ui}</>,
  })
  const chapterRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/scriptures/$collection/$book/$chapter',
    component: () => <div>chapter</div>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, chapterRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router} />)
}

const baseProps = {
  collection: 'bofm',
  book: 'mosiah',
  chapter: 3,
  verse: 19,
  textHtml: '主のみもとに帰る道はただ一つ',
  count: 0,
}

describe('VerseRow', () => {
  it("mode='read' で節番号と本文を表示し、リンクとして機能する", () => {
    renderInRouter(
      <VerseRow {...baseProps} mode="read" selected={false} onSelect={vi.fn()} />,
    )
    expect(screen.getByText('19')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('/scriptures/bofm/mosiah/3'),
    )
  })

  it("mode='select' でクリックすると onSelect が呼ばれ、リンク遷移は起きない", async () => {
    const onSelect = vi.fn()
    renderInRouter(
      <VerseRow {...baseProps} mode="select" selected={false} onSelect={onSelect} />,
    )
    expect(screen.queryByRole('link')).toBeNull()
    await userEvent.click(screen.getByTestId('verse-row-19'))
    expect(onSelect).toHaveBeenCalledWith(19)
  })

  it("mode='select' かつ selected=true でチェックマークとアクセントを表示", () => {
    renderInRouter(
      <VerseRow {...baseProps} mode="select" selected={true} onSelect={vi.fn()} />,
    )
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toHaveAttribute('aria-checked', 'true')
  })

  it('count > 0 で件数バッジを表示する', () => {
    renderInRouter(
      <VerseRow {...baseProps} count={3} mode="read" selected={false} onSelect={vi.fn()} />,
    )
    expect(screen.getByText('3件')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd apps/pwa && pnpm vitest run tests/features/select-scripture-verses/VerseRow.test.tsx`

Expected: FAIL（`VerseRow` が未定義）

- [ ] **Step 3: 実装**

`apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx`:

```tsx
import type { CSSProperties, MouseEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, ChevronRight } from 'lucide-react'
import { SanitizedVerseHtml } from '@/shared/ui'

type Props = {
  collection: string
  book: string
  chapter: number
  verse: number
  textHtml?: string
  count: number
  mode: 'read' | 'select'
  selected: boolean
  onSelect: (verse: number) => void
}

export function VerseRow({
  collection,
  book,
  chapter,
  verse,
  textHtml,
  count,
  mode,
  selected,
  onSelect,
}: Props) {
  const containerStyle: CSSProperties = {
    background: selected ? 'var(--chip-bg)' : 'transparent',
    borderLeft: `3px solid ${selected ? 'var(--lagoon)' : 'transparent'}`,
    transition: 'background-color 200ms, border-color 200ms',
  }

  const inner = (
    <div className="flex items-start gap-2 px-4 py-3">
      {mode === 'select' && (
        <div
          role="checkbox"
          aria-checked={selected}
          aria-label={`${verse}節を選択`}
          className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors"
          style={{
            border: `1.5px solid ${selected ? 'var(--lagoon)' : 'var(--line)'}`,
            background: selected ? 'var(--lagoon)' : 'transparent',
          }}
        >
          {selected && (
            <Check size={12} strokeWidth={3} color="#fff" aria-hidden="true" />
          )}
        </div>
      )}
      <div
        className="flex-1 min-w-0 flex items-start justify-between gap-2"
        style={{ color: 'var(--sea-ink)' }}
      >
        <div className="flex-1 min-w-0">
          <span
            className="text-xs font-medium"
            style={{ color: 'var(--sea-ink-soft)' }}
          >
            {verse}
          </span>
          {textHtml && (
            <SanitizedVerseHtml
              html={textHtml}
              className="ml-2 text-sm"
              style={{ color: 'var(--sea-ink)' }}
            />
          )}
        </div>
        {count > 0 && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
            style={{
              background: 'var(--chip-bg)',
              border: '1px solid var(--chip-line)',
              color: 'var(--palm)',
            }}
          >
            {count}件
          </span>
        )}
        {mode === 'read' && (
          <ChevronRight
            size={16}
            className="shrink-0 mt-0.5"
            style={{ color: 'var(--sea-ink-soft)' }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  )

  if (mode === 'select') {
    const handleClick = (e: MouseEvent) => {
      e.preventDefault()
      onSelect(verse)
    }
    return (
      <button
        type="button"
        onClick={handleClick}
        className="w-full text-left"
        style={containerStyle}
        data-testid={`verse-row-${verse}`}
      >
        {inner}
      </button>
    )
  }

  return (
    <Link
      to="/scriptures/$collection/$book/$chapter"
      params={{ collection, book, chapter: String(chapter) }}
      search={{ verses: [verse] }}
      className="block"
      style={containerStyle}
      data-testid={`verse-row-${verse}`}
    >
      {inner}
    </Link>
  )
}
```

- [ ] **Step 4: テストの通過を確認**

Run: `cd apps/pwa && pnpm vitest run tests/features/select-scripture-verses/VerseRow.test.tsx`

Expected: PASS（4 テスト）

- [ ] **Step 5: コミット**

```bash
git add apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx \
        apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx
git commit -m "feat(select-verses): VerseRow を追加 (read/select 両モード対応)"
```

---

## Task 4: `shared/ui/popover.tsx`（Base UI Popover ラッパー）

**Files:**
- Create: `apps/pwa/src/shared/ui/popover.tsx`
- Modify: `apps/pwa/src/shared/ui/index.ts`

**Interfaces:**
- Consumes: `@base-ui/react/popover`
- Produces:
  - `<Popover open={boolean} onOpenChange={(o: boolean) => void}>`
  - `<PopoverTrigger render={ReactNode} />`
  - `<PopoverContent align?='start'|'center'|'end' sideOffset?=number className?=string>`

### Steps

- [ ] **Step 1: 実装**

`apps/pwa/src/shared/ui/popover.tsx`:

```tsx
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { cn } from '@/shared/lib/utils'

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root {...props} />
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

type PopoverContentProps = PopoverPrimitive.Popup.Props & {
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}

function PopoverContent({
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        sideOffset={sideOffset}
        align={align}
        className="z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            'min-w-[220px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none',
            'transition duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0',
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
```

- [ ] **Step 2: 型検査**

Run: `cd apps/pwa && pnpm typecheck`

Expected: エラー無し

- [ ] **Step 3: コミット**

```bash
git add apps/pwa/src/shared/ui/popover.tsx
git commit -m "feat(shared-ui): Base UI ベースの popover コンポーネントを追加"
```

---

## Task 5: `ComposeMenu` widget

**Files:**
- Create: `apps/pwa/src/widgets/compose-menu/ui/ComposeMenu.tsx`
- Create: `apps/pwa/src/widgets/compose-menu/index.ts`
- Create: `apps/pwa/tests/widgets/compose-menu/ComposeMenu.test.tsx`

**Interfaces:**
- Consumes:
  - `Button` from `@/shared/ui/button`
  - `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle` from `@/shared/ui/sheet`
  - `Popover`, `PopoverTrigger`, `PopoverContent` from `@/shared/ui/popover` (Task 4)
  - `useIsMobile` from `@/shared/hooks/use-mobile`
- Produces:
  - `<ComposeMenu onSelectChapter={() => void} onSelectVerses={() => void} />`

### Steps

- [ ] **Step 1: 失敗テストを追加**

`apps/pwa/tests/widgets/compose-menu/ComposeMenu.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComposeMenu } from '@/widgets/compose-menu'

vi.mock('@/shared/hooks/use-mobile', () => ({
  useIsMobile: vi.fn(() => false),
}))

const { useIsMobile } = await import('@/shared/hooks/use-mobile')

describe('ComposeMenu (desktop)', () => {
  beforeEach(() => {
    vi.mocked(useIsMobile).mockReturnValue(false)
  })

  it('「章全体に投稿」で onSelectChapter が呼ばれる', async () => {
    const onSelectChapter = vi.fn()
    render(
      <ComposeMenu onSelectChapter={onSelectChapter} onSelectVerses={vi.fn()} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /投稿/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /章全体に投稿/ }))
    expect(onSelectChapter).toHaveBeenCalledOnce()
  })

  it('「節を選んで投稿」で onSelectVerses が呼ばれる', async () => {
    const onSelectVerses = vi.fn()
    render(
      <ComposeMenu onSelectChapter={vi.fn()} onSelectVerses={onSelectVerses} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /投稿/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /節を選んで投稿/ }))
    expect(onSelectVerses).toHaveBeenCalledOnce()
  })
})

describe('ComposeMenu (mobile)', () => {
  beforeEach(() => {
    vi.mocked(useIsMobile).mockReturnValue(true)
  })

  it('モバイルでもメニュー項目が表示される', async () => {
    render(<ComposeMenu onSelectChapter={vi.fn()} onSelectVerses={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /投稿/ }))
    expect(await screen.findByRole('menuitem', { name: /章全体に投稿/ })).toBeInTheDocument()
    expect(await screen.findByRole('menuitem', { name: /節を選んで投稿/ })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd apps/pwa && pnpm vitest run tests/widgets/compose-menu/ComposeMenu.test.tsx`

Expected: FAIL（`@/widgets/compose-menu` が未定義）

- [ ] **Step 3: `ComposeMenu` を実装**

`apps/pwa/src/widgets/compose-menu/ui/ComposeMenu.tsx`:

```tsx
import { useState, type ReactNode } from 'react'
import { BookOpen, PenLine } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { useIsMobile } from '@/shared/hooks/use-mobile'

type Props = {
  onSelectChapter: () => void
  onSelectVerses: () => void
}

export function ComposeMenu({ onSelectChapter, onSelectVerses }: Props) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  const handleChapter = () => {
    setOpen(false)
    onSelectChapter()
  }
  const handleVerses = () => {
    setOpen(false)
    onSelectVerses()
  }

  const menuItems = (
    <div className="flex flex-col" role="menu">
      <MenuItem
        icon={<BookOpen size={18} aria-hidden="true" />}
        label="章全体に投稿"
        description="この章全体への感想を書く"
        onClick={handleChapter}
      />
      <MenuItem
        icon={<PenLine size={18} aria-hidden="true" />}
        label="節を選んで投稿"
        description="複数の節にまたがる投稿を書く"
        onClick={handleVerses}
      />
    </div>
  )

  const triggerLabel = (
    <>
      <PenLine size={12} aria-hidden="true" className="mr-1" />
      <span>投稿</span>
    </>
  )

  if (isMobile) {
    return (
      <>
        <Button
          size="sm"
          onClick={() => setOpen(true)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="text-xs px-3 py-1.5 rounded-full font-semibold"
          style={{ background: 'var(--lagoon)', color: '#fff' }}
        >
          {triggerLabel}
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="rounded-t-2xl gap-0 pb-6 max-h-[50dvh]"
            showCloseButton={false}
          >
            <SheetHeader className="border-b" style={{ borderColor: 'var(--line)' }}>
              <SheetTitle>投稿する</SheetTitle>
            </SheetHeader>
            {menuItems}
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            size="sm"
            aria-haspopup="menu"
            className="text-xs px-3 py-1.5 rounded-full font-semibold"
            style={{ background: 'var(--lagoon)', color: '#fff' }}
          >
            {triggerLabel}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-64">
        {menuItems}
      </PopoverContent>
    </Popover>
  )
}

type MenuItemProps = {
  icon: ReactNode
  label: string
  description: string
  onClick: () => void
}

function MenuItem({ icon, label, description, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted transition-colors text-left"
    >
      <span className="shrink-0 mt-0.5" style={{ color: 'var(--lagoon-deep)' }}>
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold" style={{ color: 'var(--sea-ink)' }}>
          {label}
        </span>
        <span className="block text-xs mt-0.5" style={{ color: 'var(--sea-ink-soft)' }}>
          {description}
        </span>
      </span>
    </button>
  )
}
```

- [ ] **Step 4: `index.ts` を作成**

`apps/pwa/src/widgets/compose-menu/index.ts`:

```typescript
export { ComposeMenu } from './ui/ComposeMenu'
```

- [ ] **Step 5: テストの通過を確認**

Run: `cd apps/pwa && pnpm vitest run tests/widgets/compose-menu/ComposeMenu.test.tsx`

Expected: PASS（3 テスト）

- [ ] **Step 6: 型検査**

Run: `cd apps/pwa && pnpm typecheck`

Expected: エラー無し

- [ ] **Step 7: コミット**

```bash
git add apps/pwa/src/widgets/compose-menu \
        apps/pwa/tests/widgets/compose-menu
git commit -m "feat(compose-menu): 投稿ボタン + メニュー widget を追加"
```

---

## Task 6: 章ページ統合（$chapter.tsx）

**Files:**
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx`

**Interfaces:**
- Consumes（新規使用）:
  - `SelectionMode`, `parseMode`, `parseSelection`, `toggleVerse` from `@/features/select-scripture-verses`
  - `SelectionModeHeader`, `VerseRow` from `@/features/select-scripture-verses/ui/*`（本タスクで export 追加）
  - `ComposeMenu` from `@/widgets/compose-menu`
- Produces: ページのみ（他タスクから import されない）

### Steps

- [ ] **Step 1: 新規コンポーネントを feature の index から export**

`apps/pwa/src/features/select-scripture-verses/index.ts` を以下に更新:

```typescript
export { VerseCheckbox } from './ui/VerseCheckbox'
export { SelectionBar } from './ui/SelectionBar'
export { SelectionModeHeader } from './ui/SelectionModeHeader'
export { VerseRow } from './ui/VerseRow'
export {
  parseSelection,
  toggleVerse,
  formatSelectionLabel,
  parseMode,
  type SelectionMode,
} from './model/useVerseSelection'
```

- [ ] **Step 2: `validateSearch` に `mode?: 'select'` を追加**

`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` の `ChapterSearch` 型と `validateSearch` を以下に置換:

```typescript
import type { SelectionMode } from '@/features/select-scripture-verses'
import { parseMode } from '@/features/select-scripture-verses'

type ChapterSearch = { verses?: number[]; select?: number[]; mode?: SelectionMode }

// validateSearch の中身:
validateSearch: (search: Record<string, unknown>): ChapterSearch => ({
  verses: search.verses !== undefined
    ? (Array.isArray(search.verses) ? search.verses : [search.verses])
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0)
    : undefined,
  select: search.select !== undefined
    ? (Array.isArray(search.select) ? search.select : [search.select])
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n > 0)
    : undefined,
  mode: parseMode(search.mode) === 'select' ? 'select' : undefined,
}),
```

- [ ] **Step 3: `ChapterView` の import と状態管理を書き換える**

同ファイル冒頭の import を更新（追加分）:

```typescript
import {
  SelectionModeHeader,
  VerseRow,
  parseSelection,
  toggleVerse,
  type SelectionMode,
} from '@/features/select-scripture-verses'
import { ComposeMenu } from '@/widgets/compose-menu'
```

不要になった import を削除:
- `SelectionBar`, `VerseCheckbox`（廃止対象、Task 7 で削除するが、この時点で ChapterView 内の参照を除去する）
- 内部で使わなくなった `Link`（節ヘッダーで残っているなら維持）

- [ ] **Step 4: `ChapterView` 本体を書き換える**

`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` の `ChapterView` 関数を以下に置換:

```tsx
function ChapterView({
  book,
  chapter,
  collection,
  posts,
  countByVerse,
  verseTexts,
  canCompose,
}: ChapterViewProps) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [composerVerses, setComposerVerses] = useState<number[] | undefined>()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const officialUrl = buildScriptureUrl({ collection, book: book.id, chapter })
  const maxVerse = book.verses[chapter - 1]

  const verseTextMap = useMemo(
    () => new Map(verseTexts.map((vt) => [vt.verse, vt])),
    [verseTexts],
  )
  const verseNumbers = useMemo(
    () => Array.from({ length: maxVerse }, (_, i) => i + 1),
    [maxVerse],
  )
  const selection = useMemo(
    () => parseSelection(search.select, maxVerse),
    [search.select, maxVerse],
  )
  const mode: SelectionMode = canCompose && search.mode === 'select' ? 'select' : 'read'

  const updateSearch = (next: Partial<ChapterSearch>) => {
    navigate({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection, book: book.id, chapter: String(chapter) },
      search: (prev) => ({
        verses: prev.verses,
        select: next.select !== undefined ? (next.select.length ? next.select : undefined) : prev.select,
        mode: next.mode !== undefined ? next.mode : prev.mode,
      }),
      replace: true,
    })
  }

  const setSelection = (next: number[]) => updateSearch({ select: next })
  const enterSelectMode = () => updateSearch({ mode: 'select' })
  const exitSelectMode = () => updateSearch({ mode: undefined, select: [] })

  const openComposerForChapter = () => {
    setComposerVerses(undefined)
    setSheetOpen(true)
  }
  const openComposerForSelection = () => {
    setComposerVerses(selection)
    setSheetOpen(true)
  }

  const onSheetOpenChange = (open: boolean) => {
    setSheetOpen(open)
    if (!open) {
      router.invalidate()
      if (mode === 'select') exitSelectMode()
    }
  }

  const chapterHeader = (
    <PageHeader
      title={`${book.name} 第${chapter}章`}
      backTo="/scriptures/$collection/$book"
      backLabel={book.name}
      action={
        <div className="flex items-center gap-3">
          <a
            href={officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline"
            style={{ color: 'var(--lagoon-deep)' }}
          >
            本文
          </a>
          {canCompose && (
            <ComposeMenu
              onSelectChapter={openComposerForChapter}
              onSelectVerses={enterSelectMode}
            />
          )}
        </div>
      }
    />
  )

  const selectionHeader = (
    <SelectionModeHeader
      count={selection.length}
      onCancel={exitSelectMode}
      onSubmit={openComposerForSelection}
    />
  )

  return (
    <div>
      {mode === 'select' ? selectionHeader : chapterHeader}
      {posts.length > 0 && (
        <div className="border-b" style={{ borderColor: 'var(--line)' }}>
          <p className="px-4 pt-3 pb-1 text-xs font-medium" style={{ color: 'var(--sea-ink-soft)' }}>
            この章への投稿
          </p>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
      <div className="p-4 pb-24">
        <ul className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--line)' }}>
          {verseNumbers.map((verse) => {
            const count = countByVerse[verse] ?? 0
            const vt = verseTextMap.get(verse)
            const isSelected = mode === 'select' && selection.includes(verse)
            return (
              <li
                key={verse}
                className="border-b last:border-b-0"
                style={{ borderColor: 'var(--line)' }}
              >
                <VerseRow
                  collection={collection}
                  book={book.id}
                  chapter={chapter}
                  verse={verse}
                  textHtml={vt?.text_html}
                  count={count}
                  mode={mode}
                  selected={isSelected}
                  onSelect={(v) => setSelection(toggleVerse(selection, v))}
                />
              </li>
            )
          })}
        </ul>
      </div>
      <PostComposerSheet
        open={sheetOpen}
        onOpenChange={onSheetOpenChange}
        initialScripture={{
          collection,
          book: book.id,
          chapter,
          verses: composerVerses,
        }}
      />
    </div>
  )
}
```

- [ ] **Step 5: 既存のインライン `ComposeButton` を維持（節ビュー用）**

`ComposeButton` 関数と `VerseView` は既存のままにする。`VerseView` は変更しない（節ビュー側のシンプルな「投稿する」1 ボタンは元設計通り）。

- [ ] **Step 6: 型検査 + 既存テスト実行**

Run: `cd apps/pwa && pnpm typecheck`

Expected: エラー無し

Run: `cd apps/pwa && pnpm vitest run`

Expected: PASS（新規追加分含む）。ただし後述の Task 7 で削除する `SelectionBar.test.tsx` / `VerseCheckbox.test.tsx` は現時点でまだ通ることを確認する。

- [ ] **Step 7: dev サーバでスモーク確認**

Run: `cd apps/pwa && pnpm dev`

以下を手動で確認（ブラウザで `http://localhost:3000/scriptures/bofm/1-nephi/1`）:
- 章ビュー初期状態でチェックボックスが表示されない
- 「投稿」ボタンをクリックでメニューが開く
- 「節を選んで投稿」でヘッダーが `SelectionModeHeader` に切り替わり、各節にチェックが出る
- 節をクリックで選択トグル
- 「キャンセル」で `read` に戻る
- URL リロード時に `?mode=select&select=...` が復元される

問題なければサーバを停止。

- [ ] **Step 8: コミット**

```bash
git add apps/pwa/src/pages/scriptures/\$collection/\$book/\$chapter.tsx \
        apps/pwa/src/features/select-scripture-verses/index.ts
git commit -m "feat(chapter): 章ビューを read/select モード切替に再構成"
```

---

## Task 7: 廃止コンポーネント削除

**Files:**
- Delete: `apps/pwa/src/features/select-scripture-verses/ui/SelectionBar.tsx`
- Delete: `apps/pwa/src/features/select-scripture-verses/ui/VerseCheckbox.tsx`
- Delete: `apps/pwa/tests/features/select-scripture-verses/SelectionBar.test.tsx`
- Delete: `apps/pwa/tests/features/select-scripture-verses/VerseCheckbox.test.tsx`
- Modify: `apps/pwa/src/features/select-scripture-verses/index.ts`
- Modify: `apps/pwa/src/features/select-scripture-verses/model/useVerseSelection.ts` (`formatSelectionLabel` を削除する場合)

**Interfaces:**
- Consumes: なし
- Produces: なし（public API から `SelectionBar`, `VerseCheckbox`, `formatSelectionLabel` を除去）

### Steps

- [ ] **Step 1: 参照確認**

Run: `cd apps/pwa && grep -rn "SelectionBar\|VerseCheckbox\|formatSelectionLabel" src/ tests/`

Expected: 削除対象ファイル自身と `verseSelection.test.ts` の `formatSelectionLabel` テスト以外で参照が見つからないこと。

- [ ] **Step 2: 削除実行**

```bash
rm apps/pwa/src/features/select-scripture-verses/ui/SelectionBar.tsx
rm apps/pwa/src/features/select-scripture-verses/ui/VerseCheckbox.tsx
rm apps/pwa/tests/features/select-scripture-verses/SelectionBar.test.tsx
rm apps/pwa/tests/features/select-scripture-verses/VerseCheckbox.test.tsx
```

- [ ] **Step 3: `useVerseSelection.ts` から `formatSelectionLabel` を削除**

`apps/pwa/src/features/select-scripture-verses/model/useVerseSelection.ts` から `formatSelectionLabel` 関数を削除。

同時に `apps/pwa/tests/features/select-scripture-verses/verseSelection.test.ts` の `describe('formatSelectionLabel', ...)` ブロックと import 部分から `formatSelectionLabel` を削除。

- [ ] **Step 4: `index.ts` を更新**

`apps/pwa/src/features/select-scripture-verses/index.ts` を以下に置換:

```typescript
export { SelectionModeHeader } from './ui/SelectionModeHeader'
export { VerseRow } from './ui/VerseRow'
export {
  parseSelection,
  toggleVerse,
  parseMode,
  type SelectionMode,
} from './model/useVerseSelection'
```

- [ ] **Step 5: 型検査 + 全テスト実行**

Run: `cd apps/pwa && pnpm typecheck && pnpm vitest run`

Expected: PASS。参照エラー・未使用 import 無し。

- [ ] **Step 6: lint**

Run: `cd apps/pwa && pnpm lint`

Expected: エラー無し

- [ ] **Step 7: コミット**

```bash
git add -A apps/pwa/src/features/select-scripture-verses \
          apps/pwa/tests/features/select-scripture-verses
git commit -m "refactor(select-verses): SelectionBar / VerseCheckbox / formatSelectionLabel を廃止"
```

---

## Task 8: 手動検証（verify skill）

**Files:** 変更なし

### Steps

- [ ] **Step 1: `/verify` skill を起動**

このプランのブランチ (`feat/inline-post-composer`) 上で `/verify` を実行し、Supabase local + Vite dev を立ち上げる。

- [ ] **Step 2: 検証シナリオ実行**

以下を Playwright MCP で確認:

1. **章ビュー初期状態**: `/scriptures/bofm/1-nephi/1` を開き、節リストにチェックボックスが表示されず、`→` のみが節末に見えることを確認
2. **「章全体に投稿」**: ヘッダー右「投稿」→「章全体に投稿」で `PostComposerSheet` が開き、節指定なしで投稿できる
3. **「節を選んで投稿」**: ヘッダー右「投稿」→「節を選んで投稿」で `SelectionModeHeader` に切り替わる。節をタップで選択トグル、選択済み節に左アクセントバーとチェックが出る
4. **投稿(n) の disabled 状態**: 0 節時に `[投稿 (0)]` が disabled、選択後に有効化
5. **投稿から復帰**: 選択後に「投稿 (n)」→ シート → 投稿成功で `read` モードに戻り、`?mode` / `?select` が URL から消えている
6. **キャンセル**: 選択モードで「キャンセル」タップで `read` に戻り、選択が消える
7. **URL 復元**: `/scriptures/bofm/1-nephi/1?mode=select&select=1,3` を直接開いてリロード → 選択モードで `1, 3` が選択済みで復元される
8. **ブラウザバック**: 選択モード中にブラウザバックで通常ビューに戻る
9. **未ログイン時**: 未ログイン状態で章ビューを開き、「投稿」ボタンとチェックボックスが表示されない
10. **節ビュー**: `/scriptures/bofm/1-nephi/1?verses=1` で「投稿する」1 ボタンのみが表示され、タップで直接シートが開く
11. **デスクトップ幅**: 1280x800 で選択モードのヘッダー・投稿メニュー（Popover）が崩れないこと
12. **モバイル幅**: 375x667 で選択モードのヘッダー・投稿メニュー（Sheet）が崩れないこと

- [ ] **Step 3: 発見した問題を修正**

必要に応じて Task 6 の実装を微修正し、追加コミット。

- [ ] **Step 4: 最終コミット（あれば）**

```bash
git add -A
git commit -m "fix(chapter): 手動検証で発見した UI 微調整"
```

---

## 完了条件

- 全タスクのチェックボックスがすべて完了
- `cd apps/pwa && pnpm typecheck` がエラー無し
- `cd apps/pwa && pnpm vitest run` が全 PASS
- `cd apps/pwa && pnpm lint` がエラー無し
- 手動検証 12 シナリオがすべて期待通り動作
- ブランチ `feat/inline-post-composer` に 7〜8 個の追加コミットが積まれている

## 実装後の PR コメント案

PR 説明に追記する要旨:

- 章ビューを `read` / `select` の明示的モード切替に再構成
- 常時表示のチェックボックスと下部フローティングバーを廃止し、視覚ノイズを削減
- 投稿導線をヘッダー右の「投稿」ボタン + メニュー（章全体 / 節を選ぶ）に一本化
- URL 同期 `?mode=select&select=...` でリロード・ブラウザバック時の状態を保持
- Base UI ベースの `Popover` を shared UI に追加
