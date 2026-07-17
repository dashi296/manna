# 投稿作成画面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 聖典の感想・洞察を投稿できる作成画面を実装する（Markdown エディタ、聖典参照セレクター、公開範囲セレクター、下書き自動保存）。

**Architecture:** FSD アーキテクチャに従い、shared → features → widgets → pages の順にボトムアップで構築。各コンポーネントは TDD で実装し、FSD スライスごとに `index.ts` でパブリック API を公開する。

**Tech Stack:** TanStack Start, React, Supabase, shadcn/ui (toggle-group, select, input, button), react-markdown, remark-gfm, Vitest, @testing-library/react

## Global Constraints

- FSD インポートルール厳守: 上位層→下位層のみ (pages→widgets→features→entities→shared)
- スライス外部からは必ず `index.ts` 経由でインポート
- コメントは原則不要。WHY が自明でない場合のみ1行
- テストは `apps/pwa/tests/` ディレクトリ配下に配置
- 全コマンドは `apps/pwa/` ディレクトリで実行

---

## ファイル構成

```
apps/pwa/src/
├── shared/ui/
│   └── MarkdownRenderer.tsx            (新規) react-markdown ラッパー
├── features/
│   ├── choose-visibility/
│   │   ├── ui/VisibilitySelector.tsx   (新規) 4段階公開範囲トグル
│   │   └── index.ts                    (新規) パブリック API
│   └── select-scripture/
│       ├── ui/ScriptureSelector.tsx     (新規) 聖典参照セレクター
│       └── index.ts                    (新規) パブリック API
├── widgets/
│   └── post-editor/
│       ├── ui/PostEditor.tsx           (新規) 統合投稿フォーム
│       └── index.ts                    (新規) パブリック API
└── pages/posts/
    └── new.tsx                         (修正) スタブ → 実装

apps/pwa/tests/
├── shared/ui/
│   └── MarkdownRenderer.test.tsx       (新規)
└── features/
    └── choose-visibility/
        └── VisibilitySelector.test.tsx  (新規)
```

---

## Task 1: MarkdownRenderer (shared/ui)

**Files:**
- Create: `apps/pwa/src/shared/ui/MarkdownRenderer.tsx`
- Create: `apps/pwa/tests/shared/ui/MarkdownRenderer.test.tsx`

**Interfaces:**
- Consumes: なし (shared 層、外部依存のみ)
- Produces: `MarkdownRenderer` コンポーネント — `{ content: string; className?: string }` を受け取り Markdown をレンダーする

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// apps/pwa/tests/shared/ui/MarkdownRenderer.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarkdownRenderer } from '@/shared/ui/MarkdownRenderer'

describe('MarkdownRenderer', () => {
  it('Markdown テキストを HTML にレンダーする', () => {
    render(<MarkdownRenderer content="**太字テスト**" />)
    const strong = screen.getByText('太字テスト')
    expect(strong.tagName).toBe('STRONG')
  })

  it('GFM のテーブルをレンダーする', () => {
    const table = '| A | B |\n|---|---|\n| 1 | 2 |'
    const { container } = render(<MarkdownRenderer content={table} />)
    expect(container.querySelector('table')).not.toBeNull()
  })

  it('className を適用する', () => {
    const { container } = render(<MarkdownRenderer content="hello" className="prose" />)
    expect(container.firstElementChild?.className).toContain('prose')
  })

  it('空文字列でもエラーにならない', () => {
    const { container } = render(<MarkdownRenderer content="" />)
    expect(container).toBeTruthy()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
pnpm test tests/shared/ui/MarkdownRenderer.test.tsx
```
期待: FAIL — `Cannot find module '@/shared/ui/MarkdownRenderer'`

- [ ] **Step 3: 実装する**

```typescript
// apps/pwa/src/shared/ui/MarkdownRenderer.tsx
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/shared/lib/utils'

type Props = {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: Props) {
  return (
    <div className={cn('prose prose-sm max-w-none break-words', className)}>
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </div>
  )
}
```

- [ ] **Step 4: テストが通過することを確認**

```bash
pnpm test tests/shared/ui/MarkdownRenderer.test.tsx
```
期待: 4 tests PASS

- [ ] **Step 5: コミット**

```bash
git add apps/pwa/src/shared/ui/MarkdownRenderer.tsx apps/pwa/tests/shared/ui/MarkdownRenderer.test.tsx
git commit -m "feat(shared): MarkdownRenderer コンポーネントを追加"
```

---

## Task 2: VisibilitySelector (features/choose-visibility)

**Files:**
- Create: `apps/pwa/src/features/choose-visibility/ui/VisibilitySelector.tsx`
- Create: `apps/pwa/src/features/choose-visibility/index.ts`
- Create: `apps/pwa/tests/features/choose-visibility/VisibilitySelector.test.tsx`

**Interfaces:**
- Consumes: shadcn `ToggleGroup`, `ToggleGroupItem` from `@/shared/ui/toggle-group`
- Produces: `VisibilitySelector` — `{ value: string; onChange: (v: string) => void }` を受け取る公開範囲セレクター

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// apps/pwa/tests/features/choose-visibility/VisibilitySelector.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VisibilitySelector } from '@/features/choose-visibility'

describe('VisibilitySelector', () => {
  it('4つの公開範囲ボタンをレンダーする', () => {
    render(<VisibilitySelector value="public" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: /全体公開/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /フォロワー/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /ファミリー/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /自分のみ/ })).toBeInTheDocument()
  })

  it('value に応じたボタンが選択状態になる', () => {
    render(<VisibilitySelector value="family" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: /ファミリー/ })).toHaveAttribute('data-state', 'on')
  })

  it('ボタンクリックで onChange が呼ばれる', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<VisibilitySelector value="public" onChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: /自分のみ/ }))
    expect(onChange).toHaveBeenCalledWith('private')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
pnpm test tests/features/choose-visibility/VisibilitySelector.test.tsx
```
期待: FAIL — `Cannot find module '@/features/choose-visibility'`

- [ ] **Step 3: 実装する**

```typescript
// apps/pwa/src/features/choose-visibility/ui/VisibilitySelector.tsx
import { Globe, Users, Heart, Lock } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

const VISIBILITY_OPTIONS = [
  { value: 'public', label: '全体公開', Icon: Globe },
  { value: 'followers', label: 'フォロワー', Icon: Users },
  { value: 'family', label: 'ファミリー', Icon: Heart },
  { value: 'private', label: '自分のみ', Icon: Lock },
] as const

type Props = {
  value: string
  onChange: (value: string) => void
}

export function VisibilitySelector({ value, onChange }: Props) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => { if (v) onChange(v) }}
      className="flex-wrap gap-2"
    >
      {VISIBILITY_OPTIONS.map(({ value: v, label, Icon }) => (
        <ToggleGroupItem
          key={v}
          value={v}
          aria-label={label}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs"
        >
          <Icon size={14} aria-hidden="true" />
          <span>{label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
```

```typescript
// apps/pwa/src/features/choose-visibility/index.ts
export { VisibilitySelector } from './ui/VisibilitySelector'
```

- [ ] **Step 4: テストが通過することを確認**

```bash
pnpm test tests/features/choose-visibility/VisibilitySelector.test.tsx
```
期待: 3 tests PASS

- [ ] **Step 5: 全テスト通過を確認してコミット**

```bash
pnpm test
git add apps/pwa/src/features/choose-visibility/ apps/pwa/tests/features/choose-visibility/
git commit -m "feat(choose-visibility): VisibilitySelector を TDD で実装"
```

---

## Task 3: ScriptureSelector (features/select-scripture)

**Files:**
- Create: `apps/pwa/src/features/select-scripture/ui/ScriptureSelector.tsx`
- Create: `apps/pwa/src/features/select-scripture/index.ts`

**Interfaces:**
- Consumes: `getAllCollections()`, `getCollection()`, `getBook()` from `@/entities/scripture`; shadcn `Select*` from `@/shared/ui/select`; `Input` from `@/shared/ui/input`
- Produces: `ScriptureSelector` — `{ value: ScriptureRefPartial; onChange: (ref: ScriptureRefPartial) => void }` を受け取る聖典参照セレクター

```typescript
type ScriptureRefPartial = {
  collection?: string
  book?: string
  chapter?: number
  verses?: number[]
}
```

- [ ] **Step 1: コンポーネントを実装する**

```typescript
// apps/pwa/src/features/select-scripture/ui/ScriptureSelector.tsx
import { getAllCollections, getCollection, getBook } from '@/entities/scripture'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/shared/ui/select'
import { Input } from '@/shared/ui/input'

export type ScriptureRefPartial = {
  collection?: string
  book?: string
  chapter?: number
  verses?: number[]
}

type Props = {
  value: ScriptureRefPartial
  onChange: (ref: ScriptureRefPartial) => void
}

function parseVerses(input: string): number[] {
  return input
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0)
}

export function ScriptureSelector({ value, onChange }: Props) {
  const collections = getAllCollections()
  const selectedCollection = value.collection ? getCollection(value.collection) : undefined
  const selectedBook = value.collection && value.book
    ? getBook(value.collection, value.book)
    : undefined

  return (
    <div className="space-y-3">
      <Select
        value={value.collection ?? ''}
        onValueChange={(v) => onChange({ collection: v })}
      >
        <SelectTrigger>
          <SelectValue placeholder="聖典集を選択" />
        </SelectTrigger>
        <SelectContent>
          {collections.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.book ?? ''}
        onValueChange={(v) => onChange({ ...value, book: v, chapter: undefined, verses: undefined })}
        disabled={!selectedCollection}
      >
        <SelectTrigger>
          <SelectValue placeholder="書籍を選択" />
        </SelectTrigger>
        <SelectContent>
          {selectedCollection?.books.map((b) => (
            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.chapter?.toString() ?? ''}
        onValueChange={(v) => onChange({ ...value, chapter: parseInt(v, 10), verses: undefined })}
        disabled={!selectedBook}
      >
        <SelectTrigger>
          <SelectValue placeholder="章を選択" />
        </SelectTrigger>
        <SelectContent>
          {selectedBook && Array.from({ length: selectedBook.chapters }, (_, i) => (
            <SelectItem key={i + 1} value={(i + 1).toString()}>
              第{i + 1}章
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        placeholder="節 (例: 7, 9)"
        disabled={!value.chapter}
        value={value.verses?.join(', ') ?? ''}
        onChange={(e) =>
          onChange({ ...value, verses: e.target.value ? parseVerses(e.target.value) : undefined })
        }
      />
    </div>
  )
}
```

```typescript
// apps/pwa/src/features/select-scripture/index.ts
export { ScriptureSelector, type ScriptureRefPartial } from './ui/ScriptureSelector'
```

- [ ] **Step 2: 全テスト通過を確認してコミット**

```bash
pnpm test
git add apps/pwa/src/features/select-scripture/
git commit -m "feat(select-scripture): ScriptureSelector を実装"
```

---

## Task 4: PostEditor (widgets/post-editor)

**Files:**
- Create: `apps/pwa/src/widgets/post-editor/ui/PostEditor.tsx`
- Create: `apps/pwa/src/widgets/post-editor/index.ts`

**Interfaces:**
- Consumes: `VisibilitySelector` from `@/features/choose-visibility`; `ScriptureSelector`, `ScriptureRefPartial` from `@/features/select-scripture`; `MarkdownRenderer` from `@/shared/ui/MarkdownRenderer`; `Button` from `@/shared/ui/button`; `supabase` from `@/shared/lib/supabase`
- Produces: `PostEditor` — `{ initialScripture?: ScriptureRefPartial }` を受け取る投稿フォーム widget

- [ ] **Step 1: 実装する**

```typescript
// apps/pwa/src/widgets/post-editor/ui/PostEditor.tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { MarkdownRenderer } from '@/shared/ui/MarkdownRenderer'
import { Button } from '@/shared/ui/button'
import { supabase } from '@/shared/lib/supabase'
import { VisibilitySelector } from '@/features/choose-visibility'
import { ScriptureSelector, type ScriptureRefPartial } from '@/features/select-scripture'

const DRAFT_KEY = 'manna:post-draft'

type Draft = {
  content: string
  visibility: string
  scripture: ScriptureRefPartial
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { content: '', visibility: 'public', scripture: {} }
}

type Props = {
  initialScripture?: ScriptureRefPartial
}

export function PostEditor({ initialScripture }: Props) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [scripture, setScripture] = useState<ScriptureRefPartial>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const draft = loadDraft()
    setContent(draft.content)
    setVisibility(draft.visibility)
    setScripture(initialScripture?.collection ? initialScripture : draft.scripture)
  }, [])

  const saveDraft = useCallback(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ content, visibility, scripture }))
  }, [content, visibility, scripture])

  useEffect(() => {
    saveDraft()
  }, [saveDraft])

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitting(false); return }

    const { error } = await supabase.from('posts').insert({
      user_id: user.id,
      content,
      visibility: visibility as 'public' | 'followers' | 'family' | 'private',
      scripture_collection: scripture.collection ?? null,
      scripture_book: scripture.book ?? null,
      scripture_chapter: scripture.chapter ?? null,
      scripture_verses: scripture.verses ?? null,
    })

    if (error) {
      setSubmitting(false)
      return
    }

    localStorage.removeItem(DRAFT_KEY)
    navigate({ to: '/' })
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex gap-2 border-b" style={{ borderColor: 'var(--line)' }}>
        <button
          type="button"
          onClick={() => setTab('edit')}
          className="px-3 py-2 text-sm font-medium border-b-2 transition-colors"
          style={{
            borderColor: tab === 'edit' ? 'var(--lagoon-deep)' : 'transparent',
            color: tab === 'edit' ? 'var(--lagoon-deep)' : 'var(--sea-ink-soft)',
          }}
        >
          編集
        </button>
        <button
          type="button"
          onClick={() => setTab('preview')}
          className="px-3 py-2 text-sm font-medium border-b-2 transition-colors"
          style={{
            borderColor: tab === 'preview' ? 'var(--lagoon-deep)' : 'transparent',
            color: tab === 'preview' ? 'var(--lagoon-deep)' : 'var(--sea-ink-soft)',
          }}
        >
          プレビュー
        </button>
      </div>

      {tab === 'edit' ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="聖典を読んで感じたことを書いてみましょう..."
          className="w-full min-h-[200px] rounded-md border p-3 text-sm resize-y focus:outline-none focus:ring-2"
          style={{
            borderColor: 'var(--line)',
            background: 'var(--surface)',
            color: 'var(--sea-ink)',
          }}
        />
      ) : (
        <div
          className="min-h-[200px] rounded-md border p-3"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
        >
          {content ? (
            <MarkdownRenderer content={content} />
          ) : (
            <p className="text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
              プレビューする内容がありません
            </p>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--sea-ink-soft)' }}>
            聖典参照（任意）
          </p>
          <ScriptureSelector value={scripture} onChange={setScripture} />
        </div>

        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--sea-ink-soft)' }}>
            公開範囲
          </p>
          <VisibilitySelector value={visibility} onChange={setVisibility} />
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!content.trim() || submitting}
        className="w-full"
      >
        {submitting ? '投稿中...' : '投稿する'}
      </Button>
    </div>
  )
}
```

```typescript
// apps/pwa/src/widgets/post-editor/index.ts
export { PostEditor } from './ui/PostEditor'
```

- [ ] **Step 2: 全テスト通過を確認してコミット**

```bash
pnpm test
git add apps/pwa/src/widgets/post-editor/
git commit -m "feat(post-editor): PostEditor widget を実装"
```

---

## Task 5: posts/new.tsx ルート

**Files:**
- Modify: `apps/pwa/src/pages/posts/new.tsx`

**Interfaces:**
- Consumes: `PostEditor` from `@/widgets/post-editor`; `PageHeader` from `@/shared/ui`; `ScriptureRefPartial` from `@/features/select-scripture`

- [ ] **Step 1: ルートを実装する**

```typescript
// apps/pwa/src/pages/posts/new.tsx
import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/shared/ui'
import { PostEditor } from '@/widgets/post-editor'
import type { ScriptureRefPartial } from '@/features/select-scripture'

type SearchParams = {
  collection?: string
  book?: string
  chapter?: string
  verses?: string
}

function parseSearchParams(search: SearchParams): ScriptureRefPartial | undefined {
  if (!search.collection) return undefined
  return {
    collection: search.collection,
    book: search.book,
    chapter: search.chapter ? parseInt(search.chapter, 10) : undefined,
    verses: search.verses
      ? search.verses.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
      : undefined,
  }
}

export const Route = createFileRoute('/posts/new')({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    collection: search.collection as string | undefined,
    book: search.book as string | undefined,
    chapter: search.chapter as string | undefined,
    verses: search.verses as string | undefined,
  }),
  component: PostNewPage,
})

function PostNewPage() {
  const search = Route.useSearch()
  const initialScripture = parseSearchParams(search)

  return (
    <div>
      <PageHeader title="新しい投稿" backTo="/" backLabel="戻る" />
      <PostEditor initialScripture={initialScripture} />
    </div>
  )
}
```

- [ ] **Step 2: 型チェックと全テスト通過を確認してコミット**

```bash
npx tsc --noEmit 2>&1 | grep -v "callback.ts(5,38)"
pnpm test
git add apps/pwa/src/pages/posts/new.tsx
git commit -m "feat(posts): 投稿作成画面を実装"
```

---

## 完了後の確認

全タスク完了後に以下を実行:

```bash
pnpm test
npx tsc --noEmit
```

期待:
- 既存 47 テスト + 新規 7 テスト (MarkdownRenderer 4 + VisibilitySelector 3) = 約 54 テスト PASS
- 型エラーなし (callback.ts のルートツリー警告のみ既知)
