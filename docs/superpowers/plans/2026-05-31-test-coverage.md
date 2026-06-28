# テストカバレッジ拡充 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 実装済みのコンポーネント・ユーティリティ・フックに対してユニットテストを追加し、リグレッション安全網を整える。

**Architecture:** 既存の Vitest + @testing-library/react 構成を踏襲。ルーターに依存するコンポーネントは `vi.mock('@tanstack/react-router', ...)` でモックする。Supabase/SSR に依存するコード（auth.ts, AppSidebar 等）は統合テストが必要なため今回のスコープ外とする。

**Tech Stack:** Vitest, @testing-library/react, jsdom, @testing-library/jest-dom

---

## テスト対象の整理

| ファイル | 状態 | 理由 |
|---|---|---|
| `shared/lib/utils.ts` — `cn()` | ✅ 追加対象 | 純粋関数、依存なし |
| `entities/scripture` — `getCollection()` `getAllCollections()` | ✅ 追加対象 | 純粋関数、既存テストに追記 |
| `shared/ui/skeleton.tsx` — `Skeleton` `PostCardSkeleton` | ✅ 追加対象 | 純粋レンダー、依存なし |
| `shared/ui/PageHeader.tsx` — `PageHeader` | ✅ 追加対象 | router mock が必要だが単純 |
| `shared/ui/BottomNav.tsx` — `BottomNav` | ✅ 追加対象 | router mock + アクティブ状態ロジック |
| `shared/hooks/use-mobile.tsx` — `useIsMobile()` | ✅ 追加対象 | matchMedia モックが必要 |
| `shared/lib/auth.ts` | ⛔ スコープ外 | Supabase + SSR サーバー関数に依存 |
| `shared/lib/supabase.ts` | ⛔ スコープ外 | 環境変数 + Supabase SDK |
| `shared/ui/AppSidebar.tsx` | ⛔ スコープ外 | 非同期 auth + router の複合依存 |
| pages/* | ⛔ スコープ外 | SSR / ルートレベルコンポーネント |

---

## ファイル構成

```
apps/pwa/tests/
├── setup.ts                                 (既存)
├── entities/
│   ├── post/PostCard.test.tsx               (既存)
│   └── scripture/scriptureUtils.test.ts     (既存 → Task 1 で追記)
└── shared/
    ├── lib/
    │   └── utils.test.ts                    (新規 — Task 2)
    ├── ui/
    │   ├── skeleton.test.tsx                (新規 — Task 3)
    │   ├── PageHeader.test.tsx              (新規 — Task 4)
    │   └── BottomNav.test.tsx               (新規 — Task 5)
    └── hooks/
        └── use-mobile.test.ts               (新規 — Task 6)
```

---

## Task 1: entities/scripture — getCollection / getAllCollections

**Files:**
- Modify: `tests/entities/scripture/scriptureUtils.test.ts`

`getBook` のテストブロックの下に追記する。

- [ ] **Step 1: テストを追記する**

`tests/entities/scripture/scriptureUtils.test.ts` の末尾に追加:

```typescript
describe('getCollection', () => {
  it('コレクションデータを返す', () => {
    const col = getCollection('bofm')
    expect(col?.id).toBe('bofm')
    expect(Array.isArray(col?.books)).toBe(true)
  })

  it('存在しないコレクションはundefinedを返す', () => {
    expect(getCollection('unknown')).toBeUndefined()
  })
})

describe('getAllCollections', () => {
  it('全5コレクションを返す', () => {
    const cols = getAllCollections()
    expect(cols).toHaveLength(5)
    expect(cols.map((c) => c.id)).toEqual(['bofm', 'dc-testament', 'pgp', 'ot', 'nt'])
  })
})
```

インポート行に `getCollection, getAllCollections` を追加する:

```typescript
import { buildScriptureUrl, getScriptureLabel, getBook, getCollection, getAllCollections } from '@/entities/scripture'
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd apps/pwa && pnpm test 2>&1 | grep -E "FAIL|PASS|Error"
```
期待: コンパイルエラーなし（`getCollection`, `getAllCollections` は既にエクスポート済み）、テスト追加分 PASS

- [ ] **Step 3: テストを実行して通過を確認**

```bash
cd apps/pwa && pnpm test
```
期待: 全テスト PASS

- [ ] **Step 4: コミット**

```bash
git add apps/pwa/tests/entities/scripture/scriptureUtils.test.ts
git commit -m "test(scripture): getCollection / getAllCollections のテストを追加"
```

---

## Task 2: shared/lib/utils.ts — cn()

**Files:**
- Create: `tests/shared/lib/utils.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// tests/shared/lib/utils.test.ts
import { describe, it, expect } from 'vitest'
import { cn } from '@/shared/lib/utils'

describe('cn', () => {
  it('クラス名を結合する', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('条件付きクラスを処理する', () => {
    expect(cn('base', false && 'skipped', 'added')).toBe('base added')
  })

  it('undefined / null を無視する', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
  })

  it('Tailwindの競合クラスをマージする（後勝ち）', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('引数なしで空文字を返す', () => {
    expect(cn()).toBe('')
  })
})
```

- [ ] **Step 2: テストを実行して FAIL を確認**

```bash
cd apps/pwa && pnpm test tests/shared/lib/utils.test.ts 2>&1 | grep -E "FAIL|PASS|cannot find"
```
期待: ファイルがないので FAIL または「cannot find」 → ファイル作成後は PASS

- [ ] **Step 3: テストを実行して通過を確認**

```bash
cd apps/pwa && pnpm test
```
期待: 全テスト PASS（`cn` は既に実装済み）

- [ ] **Step 4: コミット**

```bash
git add apps/pwa/tests/shared/lib/utils.test.ts
git commit -m "test(utils): cn() のユニットテストを追加"
```

---

## Task 3: shared/ui/skeleton.tsx — Skeleton / PostCardSkeleton

**Files:**
- Create: `tests/shared/ui/skeleton.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// tests/shared/ui/skeleton.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Skeleton, PostCardSkeleton } from '@/shared/ui/skeleton'

describe('Skeleton', () => {
  it('animate-pulse クラスを持つ div をレンダーする', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstChild as HTMLElement
    expect(el.tagName).toBe('DIV')
    expect(el.className).toContain('animate-pulse')
  })

  it('追加クラスを受け付ける', () => {
    const { container } = render(<Skeleton className="w-10 h-10" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('w-10')
    expect(el.className).toContain('h-10')
  })
})

describe('PostCardSkeleton', () => {
  it('複数の Skeleton 要素をレンダーする', () => {
    const { container } = render(<PostCardSkeleton />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(3)
  })
})
```

- [ ] **Step 2: テストを実行して FAIL を確認**

```bash
cd apps/pwa && pnpm test tests/shared/ui/skeleton.test.tsx 2>&1 | grep -E "FAIL|PASS|cannot find"
```
期待: ファイルがないので FAIL

- [ ] **Step 3: テストを実行して通過を確認**

```bash
cd apps/pwa && pnpm test
```
期待: 全テスト PASS

- [ ] **Step 4: コミット**

```bash
git add apps/pwa/tests/shared/ui/skeleton.test.tsx
git commit -m "test(skeleton): Skeleton / PostCardSkeleton のレンダーテストを追加"
```

---

## Task 4: shared/ui/PageHeader.tsx — PageHeader

`Link` コンポーネントが `@tanstack/react-router` に依存するため `vi.mock` でモックする。

**Files:**
- Create: `tests/shared/ui/PageHeader.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// tests/shared/ui/PageHeader.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from '@/shared/ui/PageHeader'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={to} {...props}>{children}</a>
  ),
}))

describe('PageHeader', () => {
  it('タイトルを表示する', () => {
    render(<PageHeader title="テストページ" />)
    expect(screen.getByRole('heading', { name: 'テストページ' })).toBeInTheDocument()
  })

  it('backTo が指定されると戻るリンクを表示する', () => {
    render(<PageHeader title="詳細" backTo="/scriptures" />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/scriptures')
  })

  it('backTo がないとリンクを表示しない', () => {
    render(<PageHeader title="フィード" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('backLabel を表示する', () => {
    render(<PageHeader title="詳細" backTo="/" backLabel="戻る" />)
    expect(screen.getByText('戻る')).toBeInTheDocument()
  })

  it('action スロットをレンダーする', () => {
    render(<PageHeader title="投稿" action={<button>送信</button>} />)
    expect(screen.getByRole('button', { name: '送信' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストを実行して FAIL を確認**

```bash
cd apps/pwa && pnpm test tests/shared/ui/PageHeader.test.tsx 2>&1 | grep -E "FAIL|PASS|cannot find"
```
期待: ファイルがないので FAIL

- [ ] **Step 3: テストを実行して通過を確認**

```bash
cd apps/pwa && pnpm test
```
期待: 全テスト PASS

- [ ] **Step 4: コミット**

```bash
git add apps/pwa/tests/shared/ui/PageHeader.test.tsx
git commit -m "test(PageHeader): レンダー・戻るリンク・action のテストを追加"
```

---

## Task 5: shared/ui/BottomNav.tsx — BottomNav

`Link` と `useRouterState` をモックする。アクティブ状態のクラス切り替えロジックを検証する。

**Files:**
- Create: `tests/shared/ui/BottomNav.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// tests/shared/ui/BottomNav.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BottomNav } from '@/shared/ui/BottomNav'

const mockPathname = vi.fn(() => '/')

vi.mock('@tanstack/react-router', () => ({
  useRouterState: () => ({ location: { pathname: mockPathname() } }),
  Link: ({ to, children, className, ...props }: { to: string; children: React.ReactNode; className?: string; [key: string]: unknown }) => (
    <a href={to} className={className} {...props}>{children}</a>
  ),
}))

describe('BottomNav', () => {
  it('5つのナビアイテムをレンダーする', () => {
    render(<BottomNav />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(5)
  })

  it('フィードリンクが "/" に向く', () => {
    render(<BottomNav />)
    const feedLink = screen.getByRole('link', { name: /フィード/ })
    expect(feedLink).toHaveAttribute('href', '/')
  })

  it('現在のパスが "/" のとき フィードリンクはアクティブクラスを持つ', () => {
    mockPathname.mockReturnValue('/')
    render(<BottomNav />)
    const feedLink = screen.getByRole('link', { name: /フィード/ })
    expect(feedLink.className).toContain('text-lagoon-deep')
  })

  it('現在のパスが "/scriptures" のとき 聖典リンクはアクティブクラスを持つ', () => {
    mockPathname.mockReturnValue('/scriptures')
    render(<BottomNav />)
    const scriptureLink = screen.getByRole('link', { name: /聖典/ })
    expect(scriptureLink.className).toContain('text-lagoon-deep')
  })

  it('非アクティブリンクはアクティブクラスを持たない', () => {
    mockPathname.mockReturnValue('/')
    render(<BottomNav />)
    const scriptureLink = screen.getByRole('link', { name: /聖典/ })
    expect(scriptureLink.className).not.toContain('text-lagoon-deep')
  })

  it('/scriptures/bofm は聖典リンクをアクティブにする（前方一致）', () => {
    mockPathname.mockReturnValue('/scriptures/bofm')
    render(<BottomNav />)
    const scriptureLink = screen.getByRole('link', { name: /聖典/ })
    expect(scriptureLink.className).toContain('text-lagoon-deep')
  })
})
```

- [ ] **Step 2: テストを実行して FAIL を確認**

```bash
cd apps/pwa && pnpm test tests/shared/ui/BottomNav.test.tsx 2>&1 | grep -E "FAIL|PASS|cannot find"
```
期待: ファイルがないので FAIL

- [ ] **Step 3: テストを実行して通過を確認**

```bash
cd apps/pwa && pnpm test
```
期待: 全テスト PASS

- [ ] **Step 4: コミット**

```bash
git add apps/pwa/tests/shared/ui/BottomNav.test.tsx
git commit -m "test(BottomNav): ナビアイテム表示・アクティブ状態のテストを追加"
```

---

## Task 6: shared/hooks/use-mobile.tsx — useIsMobile

`window.matchMedia` は jsdom で未実装のため `vi.fn()` でモックする。

**Files:**
- Create: `tests/shared/hooks/use-mobile.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// tests/shared/hooks/use-mobile.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from '@/shared/hooks/use-mobile'

function setupMatchMedia(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
  const listeners: (() => void)[] = []
  window.matchMedia = vi.fn().mockImplementation(() => ({
    addEventListener: (_: string, cb: () => void) => listeners.push(cb),
    removeEventListener: () => {},
  }))
  return { triggerChange: () => listeners.forEach((cb) => cb()) }
}

describe('useIsMobile', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('innerWidth < 768 のとき true を返す', () => {
    setupMatchMedia(375)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('innerWidth >= 768 のとき false を返す', () => {
    setupMatchMedia(1024)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('matchMedia の change イベントで再評価する', () => {
    const { triggerChange } = setupMatchMedia(1024)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 375 })
      triggerChange()
    })
    expect(result.current).toBe(true)
  })
})
```

- [ ] **Step 2: テストを実行して FAIL を確認**

```bash
cd apps/pwa && pnpm test tests/shared/hooks/use-mobile.test.ts 2>&1 | grep -E "FAIL|PASS|cannot find"
```
期待: ファイルがないので FAIL

- [ ] **Step 3: テストを実行して通過を確認**

```bash
cd apps/pwa && pnpm test
```
期待: 全テスト PASS

- [ ] **Step 4: コミット**

```bash
git add apps/pwa/tests/shared/hooks/use-mobile.test.ts
git commit -m "test(useIsMobile): モバイル判定フックのユニットテストを追加"
```

---

## 完了後の確認

全タスク完了後に以下を実行してカバレッジを確認する:

```bash
cd apps/pwa && pnpm test
```

期待出力（追加テスト数）:
- Task 1: +5 tests (getCollection x2, getAllCollections x1、既存 15 → 18)
- Task 2: +5 tests (cn x5)
- Task 3: +3 tests (Skeleton x2, PostCardSkeleton x1)
- Task 4: +5 tests (PageHeader x5)
- Task 5: +6 tests (BottomNav x6)
- Task 6: +3 tests (useIsMobile x3)

合計: 約 **40 テスト**（既存 15 + 追加 25）
