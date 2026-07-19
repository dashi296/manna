# 節一覧「誰が投稿しているか」ビュー 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 章画面 `/scriptures/:collection/:book/:chapter` の節一覧に `件数 / 誰が` のビュー切替を追加し、`?view=who` モードではサークル内（自分 ∪ フォロー中 ∪ 家族 accepted）の投稿者アバターを節ごとに重ね表示する。表示対象は localStorage 永続の個別マルチセレクトで絞り込める。

**Architecture:** `pages/scriptures/$collection/$book/$chapter.tsx` の loader を `view=who` で分岐し、`entities/user/lib/getCircleUserIds` でサークル ID を取得。`avatarsByVerse: Record<number, AvatarStackItem[]>` と `circleUsers: CircleUser[]` を返す。UI 側は新規 `features/select-verse-view/`（`ViewModeToggle` セグメント + `WhoFilterSheet` + `useWhoFilter` フック）と新規 `shared/ui/AvatarStack` を組み合わせて、既存 `features/select-scripture-verses/ui/VerseRow` に描画モードを差し込む。

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
- CSS 変数: `--lagoon`（アクセント）/ `--sea-ink`（本文色）/ `--sea-ink-soft`（薄い本文色）/ `--line`（ボーダー）/ `--chip-bg`（選択背景）/ `--chip-line`（チップ枠）/ `--palm`（バッジ色）/ `--header-bg`（ヘッダー背景）を用いる
- 元設計との整合: [`2026-07-19-verse-list-who-view-design.md`](../specs/2026-07-19-verse-list-who-view-design.md)
- localStorage キー: `manna:verseWhoFilter:v1`
- URL クエリ: `?view=who` のみが有効。デフォルト `count` は URL に載せない
- サークル定義: 自分 ∪ フォロー中 (`follows.follower_id = me` → `following_id`) ∪ 家族 accepted (`family_relationships` 双方向 `status='accepted'`)

## ファイル構成

**新規:**
- `apps/pwa/src/features/select-verse-view/model/viewMode.ts` — `VerseViewMode` 型と `parseViewMode`
- `apps/pwa/src/features/select-verse-view/model/useWhoFilter.ts` — localStorage 永続の excluded 集合フック
- `apps/pwa/src/features/select-verse-view/ui/ViewModeToggle.tsx` — 件数／誰がセグメント
- `apps/pwa/src/features/select-verse-view/ui/WhoFilterSheet.tsx` — チェックボックスシート
- `apps/pwa/src/features/select-verse-view/index.ts` — Public API
- `apps/pwa/src/shared/ui/AvatarStack.tsx` — 節行に重ね表示するアバタースタック
- `apps/pwa/src/entities/user/lib/getCircleUserIds.ts` — サーバー用サークル取得
- `apps/pwa/src/entities/user/index.ts` — Public API
- `apps/pwa/tests/features/select-verse-view/viewMode.test.ts`
- `apps/pwa/tests/features/select-verse-view/useWhoFilter.test.ts`
- `apps/pwa/tests/features/select-verse-view/ViewModeToggle.test.tsx`
- `apps/pwa/tests/features/select-verse-view/WhoFilterSheet.test.tsx`
- `apps/pwa/tests/shared/ui/AvatarStack.test.tsx`
- `apps/pwa/tests/entities/user/getCircleUserIds.test.ts`

**改修:**
- `apps/pwa/src/shared/ui/index.ts` — `AvatarStack` を export に追加
- `apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx` — `view: 'count' | 'who'`, `avatars?: AvatarStackItem[]` プロップ追加
- `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` — `view` パース、`fetchChapterData` の分岐、`ViewModeToggle`/`WhoFilterSheet` を統合
- `apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx` — `view='who'` ケース追加
- `apps/pwa/tests/pages/scriptures/chapter.test.tsx` — `view=who` 統合ケース追加

---

## Task 1: `VerseViewMode` 型と `parseViewMode` ヘルパー

**Files:**
- Create: `apps/pwa/src/features/select-verse-view/model/viewMode.ts`
- Create: `apps/pwa/tests/features/select-verse-view/viewMode.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `type VerseViewMode = 'count' | 'who'`
  - `parseViewMode(input: unknown): VerseViewMode` — `'who'` のみ `'who'`、それ以外 `'count'`

### Steps

- [ ] **Step 1: 失敗テストを作成**

`apps/pwa/tests/features/select-verse-view/viewMode.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseViewMode } from '@/features/select-verse-view/model/viewMode'

describe('parseViewMode', () => {
  it("'who' を渡すと 'who' を返す", () => {
    expect(parseViewMode('who')).toBe('who')
  })

  it("undefined は 'count' にフォールバック", () => {
    expect(parseViewMode(undefined)).toBe('count')
  })

  it("それ以外の文字列は 'count'", () => {
    expect(parseViewMode('foo')).toBe('count')
    expect(parseViewMode('count')).toBe('count')
  })

  it('非文字列は count', () => {
    expect(parseViewMode(1)).toBe('count')
    expect(parseViewMode(null)).toBe('count')
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `pnpm --filter pwa test viewMode`
Expected: Cannot find module `@/features/select-verse-view/model/viewMode`

- [ ] **Step 3: 実装**

`apps/pwa/src/features/select-verse-view/model/viewMode.ts`:

```typescript
export type VerseViewMode = 'count' | 'who'

export function parseViewMode(input: unknown): VerseViewMode {
  return input === 'who' ? 'who' : 'count'
}
```

- [ ] **Step 4: pass 確認**

Run: `pnpm --filter pwa test viewMode`
Expected: 4 tests passing

- [ ] **Step 5: commit**

```bash
git add apps/pwa/src/features/select-verse-view/model/viewMode.ts \
        apps/pwa/tests/features/select-verse-view/viewMode.test.ts
git commit -m "feat(select-verse-view): parseViewMode ヘルパーを追加"
```

---

## Task 2: `AvatarStack` shared UI コンポーネント

**Files:**
- Create: `apps/pwa/src/shared/ui/AvatarStack.tsx`
- Modify: `apps/pwa/src/shared/ui/index.ts`
- Create: `apps/pwa/tests/shared/ui/AvatarStack.test.tsx`

**Interfaces:**
- Consumes: `UserSummary` を参照しない独立型
- Produces:
  - `type AvatarStackItem = { userId: string; name: string; avatarUrl: string | null }`
  - `<AvatarStack items={...} max={3} ariaLabel="..." />`
  - `items.length === 0` の時は `null` を返す

### Steps

- [ ] **Step 1: 失敗テストを作成**

`apps/pwa/tests/shared/ui/AvatarStack.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AvatarStack, type AvatarStackItem } from '@/shared/ui/AvatarStack'

const items: AvatarStackItem[] = [
  { userId: 'u1', name: '中村さん', avatarUrl: null },
  { userId: 'u2', name: '田中さん', avatarUrl: 'https://example.com/a.png' },
  { userId: 'u3', name: '佐藤さん', avatarUrl: null },
  { userId: 'u4', name: '鈴木さん', avatarUrl: null },
  { userId: 'u5', name: '山田さん', avatarUrl: null },
]

describe('AvatarStack', () => {
  it('items が空なら何もレンダリングしない', () => {
    const { container } = render(<AvatarStack items={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('items.length <= max は全員分描画、+N バッジは出さない', () => {
    render(<AvatarStack items={items.slice(0, 3)} max={3} />)
    expect(screen.getByRole('img', { name: '田中さん' })).toBeInTheDocument()
    expect(screen.queryByText(/^\+/)).toBeNull()
  })

  it('items.length > max は max 個 + +N バッジを描画', () => {
    render(<AvatarStack items={items} max={3} />)
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('ariaLabel を role=group の aria-label として反映', () => {
    render(<AvatarStack items={items.slice(0, 2)} ariaLabel="2件の投稿" />)
    expect(screen.getByRole('group', { name: '2件の投稿' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `pnpm --filter pwa test AvatarStack`
Expected: module not found

- [ ] **Step 3: 実装**

`apps/pwa/src/shared/ui/AvatarStack.tsx`:

```typescript
export type AvatarStackItem = {
  userId: string
  name: string
  avatarUrl: string | null
}

type Props = {
  items: AvatarStackItem[]
  max?: number
  ariaLabel?: string
}

const SIZE = 20

export function AvatarStack({ items, max = 3, ariaLabel }: Props) {
  if (items.length === 0) return null
  const visible = items.slice(0, max)
  const overflow = Math.max(0, items.length - max)

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex items-center"
    >
      {visible.map((item, i) => (
        <span
          key={item.userId}
          className="rounded-full shrink-0 overflow-hidden"
          style={{
            width: SIZE,
            height: SIZE,
            marginLeft: i === 0 ? 0 : -6,
            boxShadow: '0 0 0 1.5px var(--surface, #fff)',
            background: 'var(--lagoon)',
          }}
        >
          {item.avatarUrl ? (
            <img
              src={item.avatarUrl}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span
              role="img"
              aria-label={item.name}
              className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white"
            >
              {item.name.charAt(0).toUpperCase()}
            </span>
          )}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold"
          style={{
            width: SIZE,
            height: SIZE,
            marginLeft: -6,
            background: 'var(--chip-bg)',
            border: '1px solid var(--chip-line)',
            color: 'var(--palm)',
            boxShadow: '0 0 0 1.5px var(--surface, #fff)',
          }}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 4: shared/ui/index.ts に追記**

`apps/pwa/src/shared/ui/index.ts` の末尾:

```typescript
export { AvatarStack, type AvatarStackItem } from './AvatarStack'
```

- [ ] **Step 5: pass 確認**

Run: `pnpm --filter pwa test AvatarStack`
Expected: 4 tests passing

- [ ] **Step 6: commit**

```bash
git add apps/pwa/src/shared/ui/AvatarStack.tsx \
        apps/pwa/src/shared/ui/index.ts \
        apps/pwa/tests/shared/ui/AvatarStack.test.tsx
git commit -m "feat(shared/ui): AvatarStack コンポーネントを追加"
```

---

## Task 3: `useWhoFilter` フック（localStorage 永続の excluded 集合）

**Files:**
- Create: `apps/pwa/src/features/select-verse-view/model/useWhoFilter.ts`
- Create: `apps/pwa/tests/features/select-verse-view/useWhoFilter.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `const WHO_FILTER_STORAGE_KEY = 'manna:verseWhoFilter:v1'`
  - `useWhoFilter(): { excluded: Set<string>; toggle(userId: string): void; setAll(userIds: string[], include: boolean): void; isIncluded(userId: string): boolean }`
  - 初期状態は「全員 ON」（`excluded` は空 Set）

### Steps

- [ ] **Step 1: 失敗テストを作成**

`apps/pwa/tests/features/select-verse-view/useWhoFilter.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useWhoFilter,
  WHO_FILTER_STORAGE_KEY,
} from '@/features/select-verse-view/model/useWhoFilter'

describe('useWhoFilter', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('初期状態は excluded が空で、全員 isIncluded=true', () => {
    const { result } = renderHook(() => useWhoFilter())
    expect(result.current.excluded.size).toBe(0)
    expect(result.current.isIncluded('anyone')).toBe(true)
  })

  it('toggle でユーザーを excluded に加える／外す', () => {
    const { result } = renderHook(() => useWhoFilter())
    act(() => result.current.toggle('u1'))
    expect(result.current.isIncluded('u1')).toBe(false)
    act(() => result.current.toggle('u1'))
    expect(result.current.isIncluded('u1')).toBe(true)
  })

  it('toggle 後の状態を localStorage に保存する', () => {
    const { result } = renderHook(() => useWhoFilter())
    act(() => result.current.toggle('u1'))
    const stored = JSON.parse(localStorage.getItem(WHO_FILTER_STORAGE_KEY) ?? 'null')
    expect(stored).toEqual({ excluded: ['u1'] })
  })

  it('setAll(ids, false) で指定 ID をすべて excluded に、setAll(ids, true) で外す', () => {
    const { result } = renderHook(() => useWhoFilter())
    act(() => result.current.setAll(['a', 'b', 'c'], false))
    expect(result.current.isIncluded('a')).toBe(false)
    expect(result.current.isIncluded('b')).toBe(false)
    act(() => result.current.setAll(['a', 'b'], true))
    expect(result.current.isIncluded('a')).toBe(true)
    expect(result.current.isIncluded('c')).toBe(false)
  })

  it('起動時に localStorage の内容を復元する', () => {
    localStorage.setItem(
      WHO_FILTER_STORAGE_KEY,
      JSON.stringify({ excluded: ['u9'] }),
    )
    const { result } = renderHook(() => useWhoFilter())
    expect(result.current.isIncluded('u9')).toBe(false)
    expect(result.current.isIncluded('u1')).toBe(true)
  })

  it('壊れた localStorage 値は無視して空 excluded で開始する', () => {
    localStorage.setItem(WHO_FILTER_STORAGE_KEY, 'not-json')
    const { result } = renderHook(() => useWhoFilter())
    expect(result.current.excluded.size).toBe(0)
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `pnpm --filter pwa test useWhoFilter`
Expected: module not found

- [ ] **Step 3: 実装**

`apps/pwa/src/features/select-verse-view/model/useWhoFilter.ts`:

```typescript
import { useCallback, useEffect, useState } from 'react'

export const WHO_FILTER_STORAGE_KEY = 'manna:verseWhoFilter:v1'

type Stored = { excluded: string[] }

function readStorage(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(WHO_FILTER_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as Stored
    if (!Array.isArray(parsed?.excluded)) return new Set()
    return new Set(parsed.excluded.filter((v) => typeof v === 'string'))
  } catch {
    return new Set()
  }
}

function writeStorage(excluded: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    const value: Stored = { excluded: [...excluded] }
    window.localStorage.setItem(WHO_FILTER_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // ignore quota / private-mode errors
  }
}

export function useWhoFilter() {
  const [excluded, setExcluded] = useState<Set<string>>(() => readStorage())

  useEffect(() => {
    writeStorage(excluded)
  }, [excluded])

  const toggle = useCallback((userId: string) => {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }, [])

  const setAll = useCallback((userIds: string[], include: boolean) => {
    setExcluded((prev) => {
      const next = new Set(prev)
      for (const id of userIds) {
        if (include) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }, [])

  const isIncluded = useCallback((userId: string) => !excluded.has(userId), [excluded])

  return { excluded, toggle, setAll, isIncluded }
}
```

- [ ] **Step 4: pass 確認**

Run: `pnpm --filter pwa test useWhoFilter`
Expected: 6 tests passing

- [ ] **Step 5: commit**

```bash
git add apps/pwa/src/features/select-verse-view/model/useWhoFilter.ts \
        apps/pwa/tests/features/select-verse-view/useWhoFilter.test.ts
git commit -m "feat(select-verse-view): useWhoFilter フックを追加"
```

---

## Task 4: `ViewModeToggle` セグメントコントロール

**Files:**
- Create: `apps/pwa/src/features/select-verse-view/ui/ViewModeToggle.tsx`
- Create: `apps/pwa/tests/features/select-verse-view/ViewModeToggle.test.tsx`

**Interfaces:**
- Consumes: `VerseViewMode` from Task 1
- Produces:
  - `<ViewModeToggle value={mode} onChange={(next) => void} />`
  - `role="radiogroup"` + 2 個の `role="radio"` ボタン（`件数` / `誰が`）

### Steps

- [ ] **Step 1: 失敗テストを作成**

`apps/pwa/tests/features/select-verse-view/ViewModeToggle.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ViewModeToggle } from '@/features/select-verse-view/ui/ViewModeToggle'

describe('ViewModeToggle', () => {
  it('radiogroup と 2 個の radio ボタンを描画する', () => {
    render(<ViewModeToggle value="count" onChange={vi.fn()} />)
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '件数' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: '誰が' })).toHaveAttribute('aria-checked', 'false')
  })

  it('クリックで onChange を反対側の値で呼ぶ', async () => {
    const onChange = vi.fn()
    render(<ViewModeToggle value="count" onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: '誰が' }))
    expect(onChange).toHaveBeenCalledWith('who')
  })

  it('現在値と同じボタンを押しても onChange は呼ばない', async () => {
    const onChange = vi.fn()
    render(<ViewModeToggle value="who" onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: '誰が' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `pnpm --filter pwa test ViewModeToggle`
Expected: module not found

- [ ] **Step 3: 実装**

`apps/pwa/src/features/select-verse-view/ui/ViewModeToggle.tsx`:

```typescript
import type { VerseViewMode } from '@/features/select-verse-view/model/viewMode'

type Props = {
  value: VerseViewMode
  onChange: (next: VerseViewMode) => void
}

const OPTIONS: { value: VerseViewMode; label: string }[] = [
  { value: 'count', label: '件数' },
  { value: 'who', label: '誰が' },
]

export function ViewModeToggle({ value, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="節一覧の表示モード"
      className="inline-flex items-center rounded-full overflow-hidden"
      style={{ border: '1px solid var(--line)' }}
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              if (!active) onChange(opt.value)
            }}
            className="px-3 py-1 text-xs font-medium transition-colors"
            style={{
              background: active ? 'var(--lagoon)' : 'transparent',
              color: active ? '#fff' : 'var(--sea-ink-soft)',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: pass 確認**

Run: `pnpm --filter pwa test ViewModeToggle`
Expected: 3 tests passing

- [ ] **Step 5: commit**

```bash
git add apps/pwa/src/features/select-verse-view/ui/ViewModeToggle.tsx \
        apps/pwa/tests/features/select-verse-view/ViewModeToggle.test.tsx
git commit -m "feat(select-verse-view): ViewModeToggle セグメントを追加"
```

---

## Task 5: `WhoFilterSheet` UI

**Files:**
- Create: `apps/pwa/src/features/select-verse-view/ui/WhoFilterSheet.tsx`
- Create: `apps/pwa/tests/features/select-verse-view/WhoFilterSheet.test.tsx`

**Interfaces:**
- Consumes:
  - `AvatarStackItem` from Task 2 (`userId`, `name`, `avatarUrl`) を `users` プロップとして受ける（`CircleUser` として同型を再利用）
  - `Sheet` from `@/shared/ui/sheet`
- Produces:
  - `type CircleUser = AvatarStackItem`
  - `<WhoFilterSheet open users isIncluded onToggle onSetAll onOpenChange />`
    - `users: CircleUser[]`
    - `isIncluded: (userId: string) => boolean`
    - `onToggle: (userId: string) => void`
    - `onSetAll: (ids: string[], include: boolean) => void`
    - `onOpenChange: (open: boolean) => void`

### Steps

- [ ] **Step 1: 失敗テストを作成**

`apps/pwa/tests/features/select-verse-view/WhoFilterSheet.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WhoFilterSheet } from '@/features/select-verse-view/ui/WhoFilterSheet'

const users = [
  { userId: 'u1', name: '中村さん', avatarUrl: null },
  { userId: 'u2', name: '田中さん', avatarUrl: null },
]

function renderSheet(overrides: Partial<Parameters<typeof WhoFilterSheet>[0]> = {}) {
  const onToggle = vi.fn()
  const onSetAll = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <WhoFilterSheet
      open={true}
      users={users}
      isIncluded={() => true}
      onToggle={onToggle}
      onSetAll={onSetAll}
      onOpenChange={onOpenChange}
      {...overrides}
    />,
  )
  return { onToggle, onSetAll, onOpenChange }
}

describe('WhoFilterSheet', () => {
  it('users のチェックボックスをすべて描画する', () => {
    renderSheet()
    expect(screen.getByRole('checkbox', { name: /中村さん/ })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /田中さん/ })).toBeInTheDocument()
  })

  it('isIncluded=false のユーザーは aria-checked="false"', () => {
    renderSheet({ isIncluded: (id) => id !== 'u2' })
    expect(screen.getByRole('checkbox', { name: /田中さん/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('チェックボックスをクリックすると onToggle を該当 ID で呼ぶ', async () => {
    const { onToggle } = renderSheet()
    await userEvent.click(screen.getByRole('checkbox', { name: /田中さん/ }))
    expect(onToggle).toHaveBeenCalledWith('u2')
  })

  it('「すべて解除」で onSetAll(全ID, false)', async () => {
    const { onSetAll } = renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'すべて解除' }))
    expect(onSetAll).toHaveBeenCalledWith(['u1', 'u2'], false)
  })

  it('「すべて選択」で onSetAll(全ID, true)', async () => {
    const { onSetAll } = renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'すべて選択' }))
    expect(onSetAll).toHaveBeenCalledWith(['u1', 'u2'], true)
  })

  it('users が空なら空状態文言を描画する', () => {
    renderSheet({ users: [] })
    expect(screen.getByText('フォロー中／家族の投稿がここに表示されます')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `pnpm --filter pwa test WhoFilterSheet`
Expected: module not found

- [ ] **Step 3: 実装**

`apps/pwa/src/features/select-verse-view/ui/WhoFilterSheet.tsx`:

```typescript
import { Check } from 'lucide-react'
import type { AvatarStackItem } from '@/shared/ui/AvatarStack'
import { UserAvatar } from '@/shared/ui'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet'

export type CircleUser = AvatarStackItem

type Props = {
  open: boolean
  users: CircleUser[]
  isIncluded: (userId: string) => boolean
  onToggle: (userId: string) => void
  onSetAll: (userIds: string[], include: boolean) => void
  onOpenChange: (open: boolean) => void
}

export function WhoFilterSheet({
  open,
  users,
  isIncluded,
  onToggle,
  onSetAll,
  onOpenChange,
}: Props) {
  const ids = users.map((u) => u.userId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>表示するユーザー</SheetTitle>
        </SheetHeader>
        {users.length === 0 ? (
          <p className="px-4 py-6 text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
            フォロー中／家族の投稿がここに表示されます
          </p>
        ) : (
          <>
            <div className="flex gap-3 px-4 py-2">
              <button
                type="button"
                onClick={() => onSetAll(ids, true)}
                className="text-xs underline"
                style={{ color: 'var(--lagoon-deep)' }}
              >
                すべて選択
              </button>
              <button
                type="button"
                onClick={() => onSetAll(ids, false)}
                className="text-xs underline"
                style={{ color: 'var(--lagoon-deep)' }}
              >
                すべて解除
              </button>
            </div>
            <ul className="pb-4">
              {users.map((u) => {
                const checked = isIncluded(u.userId)
                return (
                  <li key={u.userId}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      aria-label={`${u.name}を表示`}
                      onClick={() => onToggle(u.userId)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-left"
                    >
                      <span
                        aria-hidden="true"
                        className="shrink-0 w-5 h-5 rounded flex items-center justify-center"
                        style={{
                          border: `1.5px solid ${checked ? 'var(--lagoon)' : 'var(--line)'}`,
                          background: checked ? 'var(--lagoon)' : 'transparent',
                        }}
                      >
                        {checked && <Check size={12} strokeWidth={3} color="#fff" />}
                      </span>
                      <UserAvatar name={u.name} url={u.avatarUrl} size="xs" />
                      <span className="text-sm" style={{ color: 'var(--sea-ink)' }}>
                        {u.name}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 4: pass 確認**

Run: `pnpm --filter pwa test WhoFilterSheet`
Expected: 6 tests passing

- [ ] **Step 5: commit**

```bash
git add apps/pwa/src/features/select-verse-view/ui/WhoFilterSheet.tsx \
        apps/pwa/tests/features/select-verse-view/WhoFilterSheet.test.tsx
git commit -m "feat(select-verse-view): WhoFilterSheet を追加"
```

---

## Task 6: `select-verse-view` の Public API

**Files:**
- Create: `apps/pwa/src/features/select-verse-view/index.ts`

**Interfaces:**
- Consumes: Task 1, 3, 4, 5 のシンボル
- Produces:
  - `parseViewMode`, `type VerseViewMode`
  - `useWhoFilter`, `WHO_FILTER_STORAGE_KEY`
  - `ViewModeToggle`
  - `WhoFilterSheet`, `type CircleUser`

### Steps

- [ ] **Step 1: 実装**

`apps/pwa/src/features/select-verse-view/index.ts`:

```typescript
export { parseViewMode, type VerseViewMode } from './model/viewMode'
export { useWhoFilter, WHO_FILTER_STORAGE_KEY } from './model/useWhoFilter'
export { ViewModeToggle } from './ui/ViewModeToggle'
export { WhoFilterSheet, type CircleUser } from './ui/WhoFilterSheet'
```

- [ ] **Step 2: import 経路が通ることを確認するテスト**

`apps/pwa/tests/features/select-verse-view/viewMode.test.ts` の import を経路 `@/features/select-verse-view` 経由に差し替え、再実行 pass 確認:

```typescript
import { parseViewMode } from '@/features/select-verse-view'
```

Run: `pnpm --filter pwa test features/select-verse-view`
Expected: すべて pass

- [ ] **Step 3: commit**

```bash
git add apps/pwa/src/features/select-verse-view/index.ts \
        apps/pwa/tests/features/select-verse-view/viewMode.test.ts
git commit -m "feat(select-verse-view): 公開 API を index.ts で提供"
```

---

## Task 7: `getCircleUserIds` サーバーヘルパー (`entities/user`)

**Files:**
- Create: `apps/pwa/src/entities/user/lib/getCircleUserIds.ts`
- Create: `apps/pwa/src/entities/user/index.ts`
- Create: `apps/pwa/tests/entities/user/getCircleUserIds.test.ts`

**Interfaces:**
- Consumes: `SupabaseServer` は `Awaited<ReturnType<typeof createSupabaseServer>>` と等価と想定。テスト時は最小 fake で置換
- Produces:
  - `type CircleUserRow = { id: string; display_name: string | null; avatar_url: string | null }`
  - `async function getCircleUserIds(supabase, userId): Promise<{ ids: string[]; users: CircleUserRow[] }>`
    - `ids` は self を含み、重複排除・順序不定
    - `users` は `ids` に対応する `users` テーブルレコード

### Steps

- [ ] **Step 1: 失敗テストを作成**

`apps/pwa/tests/entities/user/getCircleUserIds.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { getCircleUserIds } from '@/entities/user/lib/getCircleUserIds'

function makeSupabase({
  follows,
  family,
  users,
}: {
  follows: { following_id: string }[]
  family: { requester_id: string; addressee_id: string }[]
  users: { id: string; display_name: string | null; avatar_url: string | null }[]
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'follows') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: follows }),
          }),
        }
      }
      if (table === 'family_relationships') {
        return {
          select: () => ({
            eq: () => ({
              or: () => Promise.resolve({ data: family }),
            }),
          }),
        }
      }
      if (table === 'users') {
        return {
          select: () => ({
            in: (_col: string, ids: string[]) =>
              Promise.resolve({
                data: users.filter((u) => ids.includes(u.id)),
              }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    }),
  }
}

describe('getCircleUserIds', () => {
  it('自分 + フォロー + 家族(accepted) を dedup した ID とレコードを返す', async () => {
    const supabase = makeSupabase({
      follows: [{ following_id: 'follow-a' }, { following_id: 'shared' }],
      family: [
        { requester_id: 'me', addressee_id: 'family-a' },
        { requester_id: 'shared', addressee_id: 'me' },
      ],
      users: [
        { id: 'me', display_name: '私', avatar_url: null },
        { id: 'follow-a', display_name: 'A', avatar_url: null },
        { id: 'family-a', display_name: 'B', avatar_url: null },
        { id: 'shared', display_name: 'C', avatar_url: null },
      ],
    })

    const result = await getCircleUserIds(
      supabase as unknown as Parameters<typeof getCircleUserIds>[0],
      'me',
    )

    expect(new Set(result.ids)).toEqual(new Set(['me', 'follow-a', 'family-a', 'shared']))
    expect(result.users.map((u) => u.id).sort()).toEqual(
      ['follow-a', 'family-a', 'me', 'shared'].sort(),
    )
  })

  it('follows / family が null の場合でも self だけの結果を返す', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'follows') {
          return { select: () => ({ eq: () => Promise.resolve({ data: null }) }) }
        }
        if (table === 'family_relationships') {
          return {
            select: () => ({
              eq: () => ({ or: () => Promise.resolve({ data: null }) }),
            }),
          }
        }
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [{ id: 'me', display_name: '私', avatar_url: null }],
              }),
          }),
        }
      }),
    }

    const result = await getCircleUserIds(
      supabase as unknown as Parameters<typeof getCircleUserIds>[0],
      'me',
    )
    expect(result.ids).toEqual(['me'])
    expect(result.users).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `pnpm --filter pwa test getCircleUserIds`
Expected: module not found

- [ ] **Step 3: 実装**

`apps/pwa/src/entities/user/lib/getCircleUserIds.ts`:

```typescript
import type { createSupabaseServer } from '@/shared/lib/auth'

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServer>>

export type CircleUserRow = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

export async function getCircleUserIds(
  supabase: SupabaseServer,
  userId: string,
): Promise<{ ids: string[]; users: CircleUserRow[] }> {
  const [followsRes, familyRes] = await Promise.all([
    supabase.from('follows').select('following_id').eq('follower_id', userId),
    supabase
      .from('family_relationships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
  ])

  const ids = new Set<string>([userId])
  ;(followsRes.data ?? []).forEach((f) => ids.add((f as { following_id: string }).following_id))
  ;(familyRes.data ?? []).forEach((r) => {
    const row = r as { requester_id: string; addressee_id: string }
    ids.add(row.requester_id === userId ? row.addressee_id : row.requester_id)
  })
  const idList = [...ids]

  const { data: users } = await supabase
    .from('users')
    .select('id, display_name, avatar_url')
    .in('id', idList)

  return { ids: idList, users: (users ?? []) as CircleUserRow[] }
}
```

- [ ] **Step 4: entities/user/index.ts を作成**

`apps/pwa/src/entities/user/index.ts`:

```typescript
export { getCircleUserIds, type CircleUserRow } from './lib/getCircleUserIds'
```

- [ ] **Step 5: pass 確認**

Run: `pnpm --filter pwa test getCircleUserIds`
Expected: 2 tests passing

- [ ] **Step 6: commit**

```bash
git add apps/pwa/src/entities/user/lib/getCircleUserIds.ts \
        apps/pwa/src/entities/user/index.ts \
        apps/pwa/tests/entities/user/getCircleUserIds.test.ts
git commit -m "feat(entities/user): getCircleUserIds サーバーヘルパーを追加"
```

---

## Task 8: `VerseRow` に `view` / `avatars` プロップ

**Files:**
- Modify: `apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx`
- Modify: `apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx`

**Interfaces:**
- Consumes: `AvatarStack`, `AvatarStackItem` from Task 2
- Produces: 既存 `VerseRow` の Props に以下を追加:
  - `view?: 'count' | 'who'` — 既定 `'count'`
  - `avatars?: AvatarStackItem[]` — `view='who'` の時のみ参照される
- `view='who'` かつ `avatars?.length > 0` で `<AvatarStack>` を件数バッジの位置に描画
- `view='who'` かつ `avatars?.length === 0` は何も描画しない（Chevron のみ）
- `view='count'` かつ `count > 0` は既存の「N件」バッジ

### Steps

- [ ] **Step 1: 失敗テストを追加**

`apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx` の末尾に:

```typescript
describe("VerseRow view='who'", () => {
  const avatars = [
    { userId: 'u1', name: '中村さん', avatarUrl: null },
    { userId: 'u2', name: '田中さん', avatarUrl: null },
  ]

  it("view='who' かつ avatars ありでアバターグループを描画し、件数バッジは出さない", async () => {
    renderInRouter(
      <VerseRow
        {...baseProps}
        count={2}
        mode="read"
        selected={false}
        onSelect={vi.fn()}
        view="who"
        avatars={avatars}
      />,
    )
    await waitFor(() => {
      expect(screen.getByRole('group')).toBeInTheDocument()
      expect(screen.queryByText('2件')).toBeNull()
    })
  })

  it("view='who' かつ avatars 空はアバターも件数バッジも描画しない", async () => {
    renderInRouter(
      <VerseRow
        {...baseProps}
        count={3}
        mode="read"
        selected={false}
        onSelect={vi.fn()}
        view="who"
        avatars={[]}
      />,
    )
    await waitFor(() => {
      expect(screen.queryByRole('group')).toBeNull()
      expect(screen.queryByText('3件')).toBeNull()
    })
  })

  it("view 未指定は既存の 'count' 挙動（件数バッジ）", async () => {
    renderInRouter(
      <VerseRow {...baseProps} count={4} mode="read" selected={false} onSelect={vi.fn()} />,
    )
    await waitFor(() => {
      expect(screen.getByText('4件')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `pnpm --filter pwa test VerseRow`
Expected: 新しい 2 テストが失敗（`view` プロップ未定義／`avatars` プロップ未使用）

- [ ] **Step 3: 実装**

`apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx` を以下に差し替え（変更点は `Props` に `view` / `avatars` を追加し、右側バッジ描画を分岐する）:

```typescript
import type { CSSProperties } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, ChevronRight } from 'lucide-react'
import { SanitizedVerseHtml } from '@/shared/ui'
import { AvatarStack, type AvatarStackItem } from '@/shared/ui/AvatarStack'

const ROW_TRANSITION = 'background-color 200ms, border-color 200ms'
const ROW_SELECTED_STYLE: CSSProperties = {
  background: 'var(--chip-bg)',
  borderLeft: '3px solid var(--lagoon)',
  transition: ROW_TRANSITION,
}
const ROW_UNSELECTED_STYLE: CSSProperties = {
  background: 'transparent',
  borderLeft: '3px solid transparent',
  transition: ROW_TRANSITION,
}

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
  view?: 'count' | 'who'
  avatars?: AvatarStackItem[]
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
  view = 'count',
  avatars,
}: Props) {
  const containerStyle = selected ? ROW_SELECTED_STYLE : ROW_UNSELECTED_STYLE

  const rightBadge =
    view === 'who' ? (
      avatars && avatars.length > 0 ? (
        <AvatarStack
          items={avatars}
          ariaLabel={`${avatars.length}件の投稿 ${avatars.map((a) => a.name).join('・')}`}
        />
      ) : null
    ) : count > 0 ? (
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
    ) : null

  const inner = (
    <div className="flex items-start gap-2 px-4 py-3">
      {mode === 'select' && (
        <div
          aria-hidden="true"
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
        {rightBadge}
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
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={`${verse}節を選択`}
        onClick={() => onSelect(verse)}
        className="w-full text-left"
        style={containerStyle}
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
    >
      {inner}
    </Link>
  )
}
```

- [ ] **Step 4: pass 確認**

Run: `pnpm --filter pwa test VerseRow`
Expected: 既存 4 + 新規 3 = 7 tests passing

- [ ] **Step 5: commit**

```bash
git add apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx \
        apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx
git commit -m "feat(select-scripture-verses): VerseRow に view/avatars プロップ追加"
```

---

## Task 9: 章 loader を `view=who` で分岐

**Files:**
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx`
- Modify: `apps/pwa/tests/pages/scriptures/chapter.test.tsx`

**Interfaces:**
- Consumes:
  - `getCircleUserIds` from `@/entities/user`
  - `parseViewMode`, `type VerseViewMode` from `@/features/select-verse-view`
  - `AvatarStackItem` from `@/shared/ui`
- Produces (loader return in chapter mode に追加):
  - `view: VerseViewMode`
  - `avatarsByVerse: Record<number, AvatarStackItem[]>`
  - `circleUsers: AvatarStackItem[]`

### Steps

- [ ] **Step 1: `validateSearch` テストを追加**

`apps/pwa/tests/pages/scriptures/chapter.test.tsx` の `validateSearch` テストブロックに追記:

```typescript
    expect(validate({ view: 'who' })).toMatchObject({ view: 'who' })
    expect(validate({ view: 'foo' })).toMatchObject({ view: undefined })
    expect(validate({})).toMatchObject({ view: undefined })
```

同じテストに合うよう、`TestLoaderData` を更新:

```typescript
type TestLoaderData = {
  book: { id: string; name: string; chapters: number; verses: number[] }
  chapter: number
  collection: string
  mode: 'chapter' | 'verse'
  verses: number[]
  posts: PostWithUser[]
  countByVerse: Record<number, number>
  verseTexts: { verse: number; text_html: string }[]
  userId: string | null
  view: 'count' | 'who'
  avatarsByVerse: Record<number, { userId: string; name: string; avatarUrl: string | null }[]>
  circleUsers: { userId: string; name: string; avatarUrl: string | null }[]
}
```

`baseChapterData` に:

```typescript
  view: 'count' as const,
  avatarsByVerse: {},
  circleUsers: [],
```

- [ ] **Step 2: 失敗を確認**

Run: `pnpm --filter pwa test chapter`
Expected: validateSearch テストで `view` プロパティ未定義エラー

- [ ] **Step 3: `validateSearch` と loader を実装**

`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` の以下の箇所を差し替える。

まず import に追加:

```typescript
import { getCircleUserIds } from '@/entities/user'
import {
  parseViewMode,
  type VerseViewMode,
} from '@/features/select-verse-view'
import type { AvatarStackItem } from '@/shared/ui'
```

`ChapterSearch` と `validateSearch`:

```typescript
type ChapterSearch = {
  verses?: number[]
  select?: number[]
  mode?: SelectionMode
  view?: 'who'
}

export const Route = createFileRoute('/scriptures/$collection/$book/$chapter')({
  validateSearch: (search: Record<string, unknown>): ChapterSearch => ({
    verses: search.verses !== undefined ? parseSelection(search.verses) : undefined,
    select: search.select !== undefined ? parseSelection(search.select) : undefined,
    mode: search.mode === 'select' ? 'select' : undefined,
    view: search.view === 'who' ? 'who' : undefined,
  }),
  loaderDeps: ({ search }) => ({ verses: search.verses, view: search.view }),
  loader: async ({ params, deps }) => { /* 下記で実装 */ },
  component: ChapterPage,
})
```

`fetchChapterData` を書き換えて `view` を受け取り分岐する:

```typescript
const fetchChapterData = createServerFn({ method: 'POST' })
  .inputValidator((data: ChapterRef & { view: VerseViewMode }) => data)
  .handler(async (ctx) => {
    const { collection, book, chapter, view } = ctx.data
    const serverSupabase = await createSupabaseServer()
    const userId = await queryCurrentUserId(serverSupabase)

    const wantWho = view === 'who' && userId !== null

    const [{ data: posts }, versePostsRes, verseTexts, circle] = await Promise.all([
      serverSupabase
        .from('posts')
        .select(POST_SELECT)
        .eq('scripture_collection', collection)
        .eq('scripture_book', book)
        .eq('scripture_chapter', chapter)
        .is('scripture_verses', null)
        .order('created_at', { ascending: false }),
      wantWho
        ? Promise.resolve({ data: [] as VersePostRow[] })
        : serverSupabase
            .from('posts')
            .select('scripture_verses')
            .eq('scripture_collection', collection)
            .eq('scripture_book', book)
            .eq('scripture_chapter', chapter)
            .not('scripture_verses', 'is', null),
      queryVerseTexts(serverSupabase, ctx.data),
      wantWho && userId ? getCircleUserIds(serverSupabase, userId) : Promise.resolve(null),
    ])

    const countByVerse: Record<number, number> = {}
    if (!wantWho) {
      ;(versePostsRes.data ?? []).forEach((p) => {
        ;(p.scripture_verses as number[] | null)?.forEach((v) => {
          countByVerse[v] = (countByVerse[v] ?? 0) + 1
        })
      })
    }

    let avatarsByVerse: Record<number, AvatarStackItem[]> = {}
    let circleUsers: AvatarStackItem[] = []
    if (wantWho && circle) {
      const userLookup = new Map(
        circle.users.map((u) => [
          u.id,
          {
            userId: u.id,
            name: u.display_name ?? '匿名ユーザー',
            avatarUrl: u.avatar_url,
          } as AvatarStackItem,
        ]),
      )
      circleUsers = [...userLookup.values()]

      const { data: whoPosts } = await serverSupabase
        .from('posts')
        .select('user_id, scripture_verses, created_at')
        .eq('scripture_collection', collection)
        .eq('scripture_book', book)
        .eq('scripture_chapter', chapter)
        .not('scripture_verses', 'is', null)
        .in('user_id', circle.ids)
        .order('created_at', { ascending: false })

      const seenPerVerse = new Map<number, Set<string>>()
      ;(whoPosts ?? []).forEach((p) => {
        const verses = (p.scripture_verses as number[] | null) ?? []
        for (const v of verses) {
          const seen = seenPerVerse.get(v) ?? new Set<string>()
          if (seen.has(p.user_id)) continue
          seen.add(p.user_id)
          seenPerVerse.set(v, seen)
          const item = userLookup.get(p.user_id)
          if (!item) continue
          const arr = avatarsByVerse[v] ?? []
          arr.push(item)
          avatarsByVerse[v] = arr
        }
      })
    }

    return {
      posts: (posts ?? []) as PostWithUser[],
      countByVerse,
      verseTexts,
      userId,
      view: wantWho ? ('who' as const) : ('count' as const),
      avatarsByVerse,
      circleUsers,
    }
  })
```

`VersePostRow` のローカル型を導入（既存 anonymous 型を明示化）:

```typescript
type VersePostRow = { scripture_verses: number[] | null }
```

`loader` 本体で `view` を渡す:

```typescript
    if (deps.verses?.length) {
      const verseCount = book.verses[chapterNum - 1]
      if (deps.verses.some((v) => v < 1 || v > verseCount)) throw notFound()
      const { posts, verseTexts, userId } = await fetchVerseData({ data: { ...base, verses: deps.verses } })
      return {
        book, chapter: chapterNum, collection: params.collection,
        mode: 'verse' as const, verses: deps.verses,
        posts, countByVerse: {} as Record<number, number>, verseTexts, userId,
        view: 'count' as const,
        avatarsByVerse: {} as Record<number, AvatarStackItem[]>,
        circleUsers: [] as AvatarStackItem[],
      }
    }

    const view = parseViewMode(deps.view)
    const data = await fetchChapterData({ data: { ...base, view } })

    return {
      book, chapter: chapterNum, collection: params.collection,
      mode: 'chapter' as const, verses: [] as number[],
      posts: data.posts,
      countByVerse: data.countByVerse,
      verseTexts: data.verseTexts,
      userId: data.userId,
      view: data.view,
      avatarsByVerse: data.avatarsByVerse,
      circleUsers: data.circleUsers,
    }
```

`ChapterPage` の分岐でも新プロパティを下に渡すよう `ChapterView` 呼び出しに `view`, `avatarsByVerse`, `circleUsers` を追加（Task 10 で使う）:

```typescript
  return <ChapterView
    book={data.book}
    chapter={data.chapter}
    collection={data.collection}
    posts={data.posts}
    countByVerse={data.countByVerse}
    verseTexts={data.verseTexts}
    canCompose={Boolean(data.userId)}
    view={data.view}
    avatarsByVerse={data.avatarsByVerse}
    circleUsers={data.circleUsers}
  />
```

`ChapterViewProps` に対応プロップ追加（実際の UI 統合は Task 10）:

```typescript
type ChapterViewProps = {
  book: Book
  chapter: number
  collection: string
  posts: PostWithUser[]
  countByVerse: Record<number, number>
  verseTexts: VerseText[]
  canCompose: boolean
  view: VerseViewMode
  avatarsByVerse: Record<number, AvatarStackItem[]>
  circleUsers: AvatarStackItem[]
}
```

- [ ] **Step 4: pass 確認**

Run: `pnpm --filter pwa test chapter`
Expected: 既存テスト + validateSearch 追加 3 ケース pass

Run: `pnpm --filter pwa typecheck` (存在すれば) または `pnpm --filter pwa build`
Expected: 型エラーなし

- [ ] **Step 5: commit**

```bash
git add apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx \
        apps/pwa/tests/pages/scriptures/chapter.test.tsx
git commit -m "feat(pages/scriptures): 章 loader を view=who で分岐"
```

---

## Task 10: 章画面 UI に `ViewModeToggle` / `WhoFilterSheet` を統合

**Files:**
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx`
- Modify: `apps/pwa/tests/pages/scriptures/chapter.test.tsx`

**Interfaces:**
- Consumes:
  - `ViewModeToggle`, `WhoFilterSheet`, `useWhoFilter`, `type CircleUser` from `@/features/select-verse-view`
- Produces: ユーザー可視の UI 統合。ロジックは以下:
  - `canCompose === false` の場合、Toggle と Filter ボタンは描画しない
  - `view === 'who'` かつ `canCompose === true` の場合、`Users` アイコンのフィルタボタンを描画
  - `mode === 'select'`（選択モード）の間はセレクションヘッダーが優先されるため、Toggle は表示しない
  - `avatarsByVerse` を `useWhoFilter().isIncluded` でフィルタし、`VerseRow` に渡す

### Steps

- [ ] **Step 1: 失敗テストを追加**

`apps/pwa/tests/pages/scriptures/chapter.test.tsx` の末尾に追加:

```typescript
  it('ログイン済みで view=count の時、件数／誰がセグメントを描画する', () => {
    render(<ChapterPage />)
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '件数' })).toHaveAttribute('aria-checked', 'true')
  })

  it('view=count で「誰が」を押すと navigate({ view: "who" }) を呼ぶ', async () => {
    const user = userEvent.setup()
    render(<ChapterPage />)
    await user.click(screen.getByRole('radio', { name: '誰が' }))
    expect(navigateSpy).toHaveBeenCalled()
    const call = navigateSpy.mock.calls.at(-1)?.[0]
    expect(call.search({})).toMatchObject({ view: 'who' })
  })

  it('view=who かつ ログイン済みならフィルタボタンを描画', () => {
    loaderData = {
      ...baseChapterData,
      view: 'who',
      circleUsers: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
    }
    render(<ChapterPage />)
    expect(screen.getByRole('button', { name: 'ユーザーで絞り込み' })).toBeInTheDocument()
  })

  it('未ログインならセグメントとフィルタボタンを出さない', () => {
    loaderData = { ...baseChapterData, userId: null }
    render(<ChapterPage />)
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.queryByRole('button', { name: 'ユーザーで絞り込み' })).toBeNull()
  })

  it('view=who で avatarsByVerse を VerseRow に渡す（アバターの alt が現れる）', () => {
    loaderData = {
      ...baseChapterData,
      view: 'who',
      circleUsers: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      avatarsByVerse: {
        1: [{ userId: 'u1', name: '中村さん', avatarUrl: null }],
      },
    }
    render(<ChapterPage />)
    expect(screen.getByRole('img', { name: '中村さん' })).toBeInTheDocument()
  })
```

`vi.mock('@tanstack/react-router', ...)` は既に `useNavigate: () => navigateSpy` を返しているため追加設定不要。

- [ ] **Step 2: 失敗を確認**

Run: `pnpm --filter pwa test chapter`
Expected: 新規 5 テスト失敗

- [ ] **Step 3: 実装 — import**

`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` の import に追加:

```typescript
import { Users } from 'lucide-react'
import {
  ViewModeToggle,
  WhoFilterSheet,
  useWhoFilter,
} from '@/features/select-verse-view'
```

- [ ] **Step 4: 実装 — `ChapterView` に Toggle と Sheet を組み込む**

`ChapterView` 内で:

```typescript
function ChapterView({
  book, chapter, collection, posts, countByVerse, verseTexts, canCompose,
  view, avatarsByVerse, circleUsers,
}: ChapterViewProps) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [composerVerses, setComposerVerses] = useState<number[] | undefined>()
  const [filterOpen, setFilterOpen] = useState(false)
  const whoFilter = useWhoFilter()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const officialUrl = buildScriptureUrl({ collection, book: book.id, chapter })
  const maxVerse = book.verses[chapter - 1]

  const verseTextMap = useMemo(
    () => new Map(verseTexts.map((vt) => [vt.verse, vt])),
    [verseTexts],
  )
  const verseNumbers = Array.from({ length: maxVerse }, (_, i) => i + 1)
  const selection = useMemo(
    () => parseSelection(search.select, maxVerse),
    [search.select, maxVerse],
  )
  const mode: SelectionMode = canCompose && search.mode === 'select' ? 'select' : 'read'

  const patchSearch = (patch: Partial<ChapterSearch>, replace = true) => {
    navigate({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection, book: book.id, chapter: String(chapter) },
      search: (prev) => ({ ...prev, ...patch }),
      replace,
    })
  }

  const setSelection = (next: number[]) =>
    patchSearch({ select: next.length ? next : undefined })
  const enterSelectMode = () => patchSearch({ mode: 'select' }, false)
  const exitSelectMode = () => patchSearch({ mode: undefined, select: undefined })
  const setView = (next: 'count' | 'who') =>
    patchSearch({ view: next === 'who' ? 'who' : undefined })

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
    if (!open) router.invalidate()
  }
  const onComposerClosed = () => {
    if (mode === 'select') exitSelectMode()
  }

  const filteredAvatarsByVerse = useMemo(() => {
    if (view !== 'who') return {}
    const result: Record<number, AvatarStackItem[]> = {}
    for (const [verse, items] of Object.entries(avatarsByVerse)) {
      const filtered = items.filter((a) => whoFilter.isIncluded(a.userId))
      if (filtered.length > 0) result[Number(verse)] = filtered
    }
    return result
  }, [view, avatarsByVerse, whoFilter])

  const headerAction = (
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
        <>
          <ViewModeToggle value={view} onChange={setView} />
          {view === 'who' && (
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              aria-label="ユーザーで絞り込み"
              className="p-1 rounded"
              style={{ color: 'var(--sea-ink-soft)' }}
            >
              <Users size={16} aria-hidden="true" />
            </button>
          )}
          <ComposeMenu
            onSelectChapter={openComposerForChapter}
            onSelectVerses={enterSelectMode}
          />
        </>
      )}
    </div>
  )

  const chapterHeader = (
    <PageHeader
      title={`${book.name} 第${chapter}章`}
      backTo="/scriptures/$collection/$book"
      backLabel={book.name}
      action={headerAction}
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
            const avatars = filteredAvatarsByVerse[verse]
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
                  view={view}
                  avatars={avatars}
                />
              </li>
            )
          })}
        </ul>
      </div>
      {canCompose && (
        <>
          <PostComposerSheet
            open={sheetOpen}
            onOpenChange={onSheetOpenChange}
            onClosed={onComposerClosed}
            initialScripture={{
              collection,
              book: book.id,
              chapter,
              verses: composerVerses,
            }}
          />
          <WhoFilterSheet
            open={filterOpen}
            users={circleUsers}
            isIncluded={whoFilter.isIncluded}
            onToggle={whoFilter.toggle}
            onSetAll={whoFilter.setAll}
            onOpenChange={setFilterOpen}
          />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 5: pass 確認**

Run: `pnpm --filter pwa test chapter`
Expected: 全テスト pass

Run: `pnpm --filter pwa test`
Expected: 既存全テスト + 新規テストが pass

Run: `pnpm --filter pwa build`
Expected: 型エラー・build エラーなし

- [ ] **Step 6: commit**

```bash
git add apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx \
        apps/pwa/tests/pages/scriptures/chapter.test.tsx
git commit -m "feat(pages/scriptures): 章画面に ViewModeToggle/WhoFilterSheet を統合"
```

---

## Task 11: Playwright / 手動確認と PR 作成

**Files:**
- なし（動作確認のみ）

**Interfaces:**
- Consumes: Task 1〜10 のすべて

### Steps

- [ ] **Step 1: verify skill を使ってローカル実機確認**

`verify` skill の手順に従い、Supabase ローカル + Vite dev を起動して以下を確認:

- ログイン済みで章画面を開く → セグメント `件数 / 誰が` が右上に表示される
- `件数` は既存挙動と同じ
- `誰が` に切替えると URL に `?view=who` が付き、節にサークル内投稿者のアバターが並ぶ
- サークル外のみが投稿した節にはアバターが出ない
- フィルタボタンからシートを開き、ユーザーを外すと即座に節一覧に反映
- 章を跨いで戻っても、フィルタは保持されている
- 未ログイン（別ブラウザまたはシークレット）で開くとセグメントもフィルタも出ない
- `?view=who` を直踏みしても件数モードで描画される

- [ ] **Step 2: commit 済みか確認して push**

```bash
git status  # 空を確認
git log main --oneline -10  # 10 コミット並んでいることを確認
```

- [ ] **Step 3: PR 作成**

```bash
gh pr create --title "feat: 節一覧に「誰が投稿しているか」ビュー切替を追加" --body "$(cat <<'EOF'
## Summary

- 章画面に `件数 / 誰が` セグメント切替を追加 (`?view=who`)
- `誰が` モードでは自分のサークル（自分 ∪ フォロー中 ∪ 家族 accepted）の投稿者アバターを節ごとに重ね表示
- サークル内の表示対象を個別マルチセレクトで絞り込むフィルタシートを追加（localStorage 永続）

Closes #47

## Test plan

- [ ] `pnpm --filter pwa test` がすべて pass
- [ ] `pnpm --filter pwa build` が成功
- [ ] ログイン済みで `?view=who` に切替えるとサークル内投稿者のアバターが節に出る
- [ ] フィルタシートでチェックを外すと即座に反映され、章を跨いでも維持される
- [ ] 未ログインではセグメントもフィルタも出ない
- [ ] `?view=who` を未ログインで直踏みしても件数モードで描画される

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 自己レビュー結果

- **仕様カバレッジ**: 設計書の各節と対応する task:
  - URL / state → Task 9 (`validateSearch` に `view` 追加)
  - localStorage 永続 → Task 3 (`useWhoFilter`)
  - フィルタ UI → Task 5 (`WhoFilterSheet`) + Task 10（Users アイコンボタン）
  - 章ヘッダー UI → Task 4 (`ViewModeToggle`) + Task 10（統合）
  - 節行の見た目 → Task 2 (`AvatarStack`) + Task 8 (`VerseRow` 更新)
  - サーバー側データ → Task 7 (`getCircleUserIds`) + Task 9（loader 分岐、user dedup、最新順、`in circle` フィルタ）
  - FSD 配置 → Task 6（`select-verse-view/index.ts`）と Task 7（`entities/user/index.ts`）
  - エッジケース: 未ログイン `view=who` fall-back → Task 9（`wantWho = view === 'who' && userId !== null`）、`?verses=` 併用時は既存 `VerseView` パスで `view` を無視 → Task 9（`fetchVerseData` 側は変更せず固定値を返す）
  - テスト → Task 1〜10 各 Step で TDD
- **プレースホルダ**: 「TODO」「TBD」「後で埋める」は無し
- **型整合**: `AvatarStackItem` が `shared/ui/AvatarStack` → 各所で再利用 (`CircleUser = AvatarStackItem` として Task 5 で export)、`VerseViewMode = 'count' | 'who'` が Task 1 で定義され Task 4, 8, 9, 10 で参照。loader が返す `view` プロパティも同型
