# モバイル章ページヘッダーの整理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 聖典の章ページのモバイルヘッダーから書名の重複と投稿ボタンを取り除き、横1行に収まるようにする。

**Architecture:** 投稿導線を `ComposePostButton`（`shared/ui`）という1つの表示コンポーネントに集約し、`layout` prop で「ヘッダー内のピル」と「右下固定の FAB」を切り替える。どちらを使うかは `useIsMobile()` で親（`ChapterView` / `VerseView`）が決め、FAB はヘッダーの**外**にマウントする。タイトルは章ビューで `第N章` に短縮し、書名は戻るリンクに任せる。

**Tech Stack:** TanStack Start / React 19 / TailwindCSS v4 / Base UI / Vitest + @testing-library/react

## Global Constraints

- 設計書: [`docs/superpowers/specs/2026-08-07-mobile-chapter-header-design.md`](../specs/2026-08-07-mobile-chapter-header-design.md)
- 作業ブランチ: `mobile-chapter-header`（作成済み。設計書のコミット `99b797f` が載っている）
- 作業ディレクトリはリポジトリルート `/Users/shunokada/projects/manna`
- テスト実行コマンドは常に `pnpm test`（内部で `vitest run`）。単一ファイルに絞る場合は `pnpm --filter @manna/pwa exec vitest run <path>`
- FSD のインポート方向を守る: `pages → widgets → features → entities → shared`。新規スライスを作ったら `index.ts` を必ず作る
- コメントは原則書かない。WHY が自明でない箇所のみ1行
- `shared/lib/scriptureUtils.ts` の `getScriptureLabel` は**変更しない**（投稿カードなど他所が依存している）
- `shared/ui/PageHeader.tsx` は**変更しない**（props の渡し方だけが変わる）

### FAB をヘッダーの中に置いてはいけない理由

`stickyHeaderStyle`（`shared/ui/PageHeader.tsx:7-11`）は `backdropFilter: 'blur(8px)'` を持つ。`backdrop-filter` が効いている要素は `position: fixed` の子孫にとって containing block になるため、ヘッダー内に置いた FAB はビューポートではなく**ヘッダーを基準に**配置されてしまう。FAB は必ずヘッダーの外（`ChapterView` / `VerseView` の返り値の直下）にマウントすること。

### `useIsMobile` のテストでの扱い

`shared/hooks/use-mobile.ts` は `useEffect` の中で `window.innerWidth < 1024` を読んで state を更新する。初回レンダーは常に `false`（＝デスクトップ）で、効果実行後にモバイル判定へ切り替わる。

- jsdom の `window.innerWidth` の既定値は `1024` なので、既存テストはすべてデスクトップ扱いになっている
- モバイルを再現するには **render の前に** `Object.defineProperty(window, 'innerWidth', { writable: true, value: 390 })` を実行する
- モバイル時に現れる要素は `findByRole`（非同期）で取る。`getByRole` では効果実行前の状態を見てしまう

---

## File Structure

| ファイル | 責務 | 変更 |
|---|---|---|
| `apps/pwa/src/shared/ui/ComposePostButton.tsx` | 投稿導線の見た目のみ。`layout` で pill / fab を切り替える | 新規 |
| `apps/pwa/src/shared/ui/index.ts` | shared/ui のパブリック API | 追記 |
| `apps/pwa/src/widgets/compose-menu/ui/ComposeMenu.tsx` | 「章全体に投稿／節を選んで投稿」の2択メニュー | `layout` prop 追加 |
| `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` | 章ビュー・節ビュー | タイトル短縮・FAB 配置・ローカル `ComposeButton` 削除 |
| `apps/pwa/tests/shared/ui/ComposePostButton.test.tsx` | 上記の単体テスト | 新規 |
| `apps/pwa/tests/widgets/compose-menu/ComposeMenu.test.tsx` | ComposeMenu のテスト | 追記 |
| `apps/pwa/tests/pages/scriptures/chapter.test.tsx` | 章ページのテスト | 追記・一部修正 |

---

## Task 1: `ComposePostButton` を shared/ui に追加する

投稿導線の見た目だけを持つコンポーネント。状態もデータ取得も持たない。

**Files:**
- Create: `apps/pwa/src/shared/ui/ComposePostButton.tsx`
- Modify: `apps/pwa/src/shared/ui/index.ts`
- Test: `apps/pwa/tests/shared/ui/ComposePostButton.test.tsx`

**Interfaces:**
- Consumes: `Button`（`@/shared/ui/button`）、`cn`（`@/shared/lib/utils`）
- Produces:
  ```ts
  type ComposePostButtonProps = ComponentProps<'button'> & {
    layout?: 'pill' | 'fab'
    label: string
  }
  export function ComposePostButton(props: ComposePostButtonProps): JSX.Element
  ```
  `label` は pill ではボタンのテキスト、fab では `aria-label` になる。`layout` の既定値は `'pill'`。`aria-haspopup` / `aria-expanded` / `onClick` などの残りの props はそのまま `Button` へ渡る。

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/shared/ui/ComposePostButton.test.tsx` を新規作成:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComposePostButton } from '@/shared/ui'

describe('ComposePostButton', () => {
  it('pill ではラベルをテキストとして表示する', () => {
    render(<ComposePostButton label="投稿する" />)
    expect(screen.getByRole('button', { name: '投稿する' })).toHaveTextContent('投稿する')
  })

  it('fab ではラベルを aria-label として持ち、テキストは表示しない', () => {
    render(<ComposePostButton layout="fab" label="投稿する" />)
    const button = screen.getByRole('button', { name: '投稿する' })
    expect(button.textContent).toBe('')
    expect(button).toHaveAttribute('aria-label', '投稿する')
  })

  it('fab は画面右下に固定配置される', () => {
    render(<ComposePostButton layout="fab" label="投稿する" />)
    expect(screen.getByRole('button', { name: '投稿する' }).className).toContain('fixed')
  })

  it('onClick と aria 属性を下位のボタンへ渡す', async () => {
    const onClick = vi.fn()
    render(
      <ComposePostButton
        layout="fab"
        label="投稿する"
        onClick={onClick}
        aria-haspopup="menu"
        aria-expanded={false}
      />,
    )
    const button = screen.getByRole('button', { name: '投稿する' })
    expect(button).toHaveAttribute('aria-haspopup', 'menu')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm --filter @manna/pwa exec vitest run tests/shared/ui/ComposePostButton.test.tsx`

Expected: FAIL。`ComposePostButton` が `@/shared/ui` から export されていないため解決エラーになる。

- [ ] **Step 3: コンポーネントを実装する**

`apps/pwa/src/shared/ui/ComposePostButton.tsx` を新規作成:

```tsx
import type { ComponentProps } from 'react'
import { PenLine } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

type Props = ComponentProps<'button'> & {
  layout?: 'pill' | 'fab'
  label: string
}

export function ComposePostButton({ layout = 'pill', label, className, ...rest }: Props) {
  if (layout === 'fab') {
    return (
      <Button
        type="button"
        variant="accent"
        aria-label={label}
        className={cn(
          'fixed right-4 bottom-[calc(var(--bottom-nav-h)+1rem)] z-30',
          'h-14 w-14 rounded-full p-0 shadow-lg [&_svg]:size-6',
          className,
        )}
        {...rest}
      >
        <PenLine aria-hidden="true" />
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="accent"
      size="pill"
      className={cn('gap-1', className)}
      {...rest}
    >
      <PenLine size={12} aria-hidden="true" />
      <span>{label}</span>
    </Button>
  )
}
```

`[&_svg]:size-6` を付けるのは、`buttonVariants` の基底クラスに `[&_svg]:size-4` があり、これを上書きしないと FAB のアイコンが 16px のままになるため（`shared/ui/button.tsx:7`）。

`z-30` は `InstallPwaBanner`（`z-40`）より低い。設計どおり、インストールバナー表示中は FAB がバナーの背面に隠れる。これは許容する仕様なので、FAB の位置を動的にずらす処理は入れないこと。

`bottom-[calc(var(--bottom-nav-h)+1rem)]` の `--bottom-nav-h` は `styles.css:89` で定義済みの既存変数（`calc(4rem + var(--safe-area-bottom))`）。新たに定義しないこと。

- [ ] **Step 4: パブリック API に追加する**

`apps/pwa/src/shared/ui/index.ts` のアルファベット順の位置（`AvatarStackItem` と `EmptyState` の間）に追記:

```ts
export { ComposePostButton } from './ComposePostButton'
```

- [ ] **Step 5: テストを実行して通過を確認する**

Run: `pnpm --filter @manna/pwa exec vitest run tests/shared/ui/ComposePostButton.test.tsx`

Expected: PASS（4件）

- [ ] **Step 6: コミット**

```bash
git add apps/pwa/src/shared/ui/ComposePostButton.tsx apps/pwa/src/shared/ui/index.ts apps/pwa/tests/shared/ui/ComposePostButton.test.tsx
git commit -m "feat: 投稿導線の表示コンポーネント ComposePostButton を追加する"
```

---

## Task 2: `ComposeMenu` に `layout` prop を追加する

モバイルのトリガーを `ComposePostButton` に差し替え、親から pill / fab を選べるようにする。デスクトップのポップオーバー経路は触らない（Base UI の `PopoverTrigger render` は ref 転送を要求するため、既存の `Button` をそのまま残す）。

**Files:**
- Modify: `apps/pwa/src/widgets/compose-menu/ui/ComposeMenu.tsx`
- Test: `apps/pwa/tests/widgets/compose-menu/ComposeMenu.test.tsx`

**Interfaces:**
- Consumes: `ComposePostButton`（Task 1）
- Produces:
  ```ts
  type ComposeMenuProps = {
    onSelectChapter: () => void
    onSelectVerses: () => void
    layout?: 'pill' | 'fab'
  }
  ```
  `layout` の既定値は `'pill'`。既存の呼び出し側は変更不要。

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/widgets/compose-menu/ComposeMenu.test.tsx` の `describe('ComposeMenu (mobile)')` ブロックの末尾（既存の `it('モバイルでもメニュー項目が表示される', ...)` の後）に追記:

```tsx
  it('layout="fab" ではトリガーが FAB になり、押すとメニューが開く', async () => {
    render(<ComposeMenu onSelectChapter={vi.fn()} onSelectVerses={vi.fn()} layout="fab" />)
    const fab = screen.getByRole('button', { name: '投稿する' })
    expect(fab.className).toContain('fixed')
    await userEvent.click(fab)
    expect(await screen.findByRole('menuitem', { name: /章全体に投稿/ })).toBeInTheDocument()
  })

  it('layout 未指定なら従来どおりピル表示のまま', () => {
    render(<ComposeMenu onSelectChapter={vi.fn()} onSelectVerses={vi.fn()} />)
    expect(screen.getByRole('button', { name: /投稿/ }).className).not.toContain('fixed')
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm --filter @manna/pwa exec vitest run tests/widgets/compose-menu/ComposeMenu.test.tsx`

Expected: FAIL。`layout="fab"` が無視されるため `fab.className` に `fixed` が含まれない。

- [ ] **Step 3: `ComposeMenu` を実装する**

`apps/pwa/src/widgets/compose-menu/ui/ComposeMenu.tsx` を次のとおり変更する。

インポートに追加:

```tsx
import { ComposePostButton } from '@/shared/ui'
```

`Props` 型を変更:

```tsx
type Props = {
  onSelectChapter: () => void
  onSelectVerses: () => void
  layout?: 'pill' | 'fab'
}
```

関数シグネチャを変更:

```tsx
export function ComposeMenu({ onSelectChapter, onSelectVerses, layout = 'pill' }: Props) {
```

`if (isMobile)` ブロックの中の `<Button>` を `ComposePostButton` に差し替える。差し替え後のモバイル分岐全体:

```tsx
  if (isMobile) {
    return (
      <>
        <ComposePostButton
          layout={layout}
          label="投稿する"
          onClick={() => setOpen(true)}
          aria-haspopup="menu"
          aria-expanded={open}
        />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="rounded-t-2xl gap-0 pb-6 max-h-[50dvh]"
            showCloseButton={false}
          >
            <SheetHeader bordered>
              <SheetTitle>投稿する</SheetTitle>
            </SheetHeader>
            {menuItems}
          </SheetContent>
        </Sheet>
      </>
    )
  }
```

`triggerContent` はデスクトップ分岐でのみ使われるようになる。`triggerContent` の定義とデスクトップの `return`（`Popover` を返すブロック）はそのまま残すこと。

- [ ] **Step 4: テストを実行して通過を確認する**

Run: `pnpm --filter @manna/pwa exec vitest run tests/widgets/compose-menu/ComposeMenu.test.tsx`

Expected: PASS（5件。既存3件＋新規2件）

- [ ] **Step 5: コミット**

```bash
git add apps/pwa/src/widgets/compose-menu/ui/ComposeMenu.tsx apps/pwa/tests/widgets/compose-menu/ComposeMenu.test.tsx
git commit -m "feat: ComposeMenu のトリガーを layout で pill/fab 切り替え可能にする"
```

---

## Task 3: 章ビューのタイトルから書名を落とす

**Files:**
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx:492`
- Test: `apps/pwa/tests/pages/scriptures/chapter.test.tsx`

**Interfaces:**
- Consumes: なし（Task 1・2 とは独立）
- Produces: なし

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/pages/scriptures/chapter.test.tsx` の `it('front matter の章表示ではタイトルに「第◯章」を付けず書名のみ表示する', ...)` の**直前**に追記:

```tsx
  it('章表示のタイトルは書名を含まず「第◯章」だけを表示する', () => {
    render(<ChapterPage />)
    expect(screen.getByRole('heading', { name: '第1章' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '第1ニーファイ書 第1章' })).toBeNull()
  })

  it('章表示の戻りリンクは書名を表示する', () => {
    render(<ChapterPage />)
    expect(screen.getByRole('link', { name: '第1ニーファイ書' })).toBeInTheDocument()
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm --filter @manna/pwa exec vitest run tests/pages/scriptures/chapter.test.tsx -t '章表示のタイトルは書名を含まず'`

Expected: FAIL。見出しが `第1ニーファイ書 第1章` のままのため `第1章` の見出しが見つからない。

- [ ] **Step 3: タイトルの分岐を実装する**

`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` の `chapterHeader`（現在 489行目付近）で、`PageHeader` の `title` を差し替える。

変更前:

```tsx
      <PageHeader
        title={getScriptureLabel(loc, book)}
```

変更後:

```tsx
      <PageHeader
        title={book.isFrontMatter ? getScriptureLabel(loc, book) : `第${chapter}章`}
```

序文・扉ページ（`isFrontMatter`）は元々タイトルが書名・戻りラベルがコレクション名で重複していないため、従来どおり `getScriptureLabel` を使う。

- [ ] **Step 4: テストを実行して通過を確認する**

Run: `pnpm --filter @manna/pwa exec vitest run tests/pages/scriptures/chapter.test.tsx`

Expected: PASS（既存テストを含め全件）。特に `front matter の章表示ではタイトルに「第◯章」を付けず書名のみ表示する` が引き続き通ることを確認する。

- [ ] **Step 5: コミット**

```bash
git add apps/pwa/src/pages/scriptures/\$collection/\$book/\$chapter.tsx apps/pwa/tests/pages/scriptures/chapter.test.tsx
git commit -m "fix: 章ページのタイトルから重複する書名を取り除く"
```

---

## Task 4: 章ビューの投稿導線をモバイルで FAB にする

**Files:**
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx`（`ChapterView` の `headerAction` と `return`）
- Test: `apps/pwa/tests/pages/scriptures/chapter.test.tsx`

**Interfaces:**
- Consumes: `ComposeMenu` の `layout` prop（Task 2）
- Produces: なし

- [ ] **Step 1: テストの前提を揃える**

`apps/pwa/tests/pages/scriptures/chapter.test.tsx` の `beforeEach` の末尾（`queryClient.clear()` の直後）に追記する。既存テストのうち2件が `innerWidth` を 1440 に書き換えたまま戻していないため、テストごとの独立性を確保する:

```tsx
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
```

- [ ] **Step 2: 失敗するテストを書く**

同ファイルの `describe('ChapterPage')` の末尾に追記:

```tsx
  it('モバイルの章表示では投稿導線をヘッダー外の FAB として表示する', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 390 })
    render(<ChapterPage />)

    const fab = await screen.findByRole('button', { name: '投稿する' })
    expect(fab.className).toContain('fixed')
    expect(fab.closest('header')).toBeNull()
  })

  it('モバイルの章表示の FAB を押すと投稿の2択メニューが開く', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 390 })
    const user = userEvent.setup()
    render(<ChapterPage />)

    await user.click(await screen.findByRole('button', { name: '投稿する' }))

    expect(await screen.findByRole('menuitem', { name: /章全体に投稿/ })).toBeInTheDocument()
    expect(await screen.findByRole('menuitem', { name: /節を選んで投稿/ })).toBeInTheDocument()
  })

  it('モバイルの節選択モード中は FAB を表示しない', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 390 })
    search = { mode: 'select', select: [1] }
    render(<ChapterPage />)

    expect(await screen.findByText('1節選択中')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '投稿する' })).toBeNull()
  })

  it('デスクトップの章表示では投稿ボタンがヘッダー内に残る', () => {
    render(<ChapterPage />)
    const trigger = screen.getByRole('button', { name: /投稿/ })
    expect(trigger.closest('header')).not.toBeNull()
    expect(trigger.className).not.toContain('fixed')
  })
```

- [ ] **Step 3: テストを実行して失敗を確認する**

Run: `pnpm --filter @manna/pwa exec vitest run tests/pages/scriptures/chapter.test.tsx -t 'モバイルの章表示'`

Expected: FAIL。モバイルでもピルがヘッダー内に描画されるため `fab.className` に `fixed` が含まれず、`closest('header')` も null にならない。

- [ ] **Step 4: `ChapterView` を実装する**

`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` の `ChapterView` を変更する。`const isMobile = useIsMobile()` は既に宣言済み（391行目付近）なので追加不要。

変更前（474-485行目付近）:

```tsx
  const headerAction = (
    <div className="flex items-center gap-2">
      {canCompose && (
        <ComposeMenu
          onSelectChapter={openComposerForChapter}
          onSelectVerses={enterSelectMode}
        />
      )}
      <BilingualToggleButton />
      <BookmarkButton loc={loc} />
    </div>
  )
```

変更後:

```tsx
  const composeMenuProps = {
    onSelectChapter: openComposerForChapter,
    onSelectVerses: enterSelectMode,
  }

  const headerAction = (
    <div className="flex items-center gap-2">
      {canCompose && !isMobile && <ComposeMenu {...composeMenuProps} />}
      <BilingualToggleButton />
      <BookmarkButton loc={loc} />
    </div>
  )

  const composeFab =
    canCompose && isMobile && mode !== 'select' ? (
      <ComposeMenu {...composeMenuProps} layout="fab" />
    ) : null
```

FAB は `backdrop-filter` を持つヘッダーの外に置く必要があるため、`ChapterView` の `return` に直接差し込む。変更前（585-587行目付近）:

```tsx
  return (
    <div>
      {mode === 'select' ? selectionHeader : chapterHeader}
```

変更後:

```tsx
  return (
    <div>
      {mode === 'select' ? selectionHeader : chapterHeader}
      {composeFab}
```

- [ ] **Step 5: テストを実行して通過を確認する**

Run: `pnpm --filter @manna/pwa exec vitest run tests/pages/scriptures/chapter.test.tsx`

Expected: PASS（全件）。既存の `選択中でも「章に投稿」は節指定なしでシートを開く` と `ComposeMenu から選択モードに入ると mode=select を push (replace: false) で反映する` はデスクトップ扱いのまま通る。

- [ ] **Step 6: コミット**

```bash
git add apps/pwa/src/pages/scriptures/\$collection/\$book/\$chapter.tsx apps/pwa/tests/pages/scriptures/chapter.test.tsx
git commit -m "feat: 章ページの投稿導線をモバイルで FAB に移す"
```

---

## Task 5: 節ビューの絵文字を落とし、投稿導線を FAB に統合する

節ビューには節選択モードが存在しないため、FAB は2択メニューを挟まず `PostComposerSheet` を直接開く。

**Files:**
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx`（`VerseView` とローカル `ComposeButton`）
- Test: `apps/pwa/tests/pages/scriptures/chapter.test.tsx`

**Interfaces:**
- Consumes: `ComposePostButton`（Task 1）、`useIsMobile`（既にファイル冒頭でインポート済み）
- Produces: なし

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/pages/scriptures/chapter.test.tsx` の `describe('ChapterPage')` の末尾に追記:

```tsx
  it('節表示のタイトルに絵文字を含めない', () => {
    loaderData = { ...baseChapterData, mode: 'verse', verses: [1] }
    render(<ChapterPage />)
    expect(screen.getByRole('heading', { name: '第1ニーファイ書 1:1' })).toBeInTheDocument()
  })

  it('モバイルの節表示では投稿導線をヘッダー外の FAB として表示する', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 390 })
    loaderData = { ...baseChapterData, mode: 'verse', verses: [1] }
    render(<ChapterPage />)

    const fab = await screen.findByRole('button', { name: '投稿する' })
    expect(fab.className).toContain('fixed')
    expect(fab.closest('header')).toBeNull()
  })

  it('節表示の投稿導線は2択メニューを挟まず composer を直接開く', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 390 })
    loaderData = { ...baseChapterData, mode: 'verse', verses: [1] }
    const user = userEvent.setup()
    render(<ChapterPage />)

    await user.click(await screen.findByRole('button', { name: '投稿する' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByRole('menuitem')).toBeNull()
  })

  it('デスクトップの節表示では投稿ボタンがヘッダー内に残る', () => {
    loaderData = { ...baseChapterData, mode: 'verse', verses: [1] }
    render(<ChapterPage />)
    const trigger = screen.getByRole('button', { name: '投稿する' })
    expect(trigger.closest('header')).not.toBeNull()
    expect(trigger.className).not.toContain('fixed')
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm --filter @manna/pwa exec vitest run tests/pages/scriptures/chapter.test.tsx -t '節表示'`

Expected: FAIL。見出しが `📖 第1ニーファイ書 1:1` のままで、投稿ボタンはヘッダー内のピルのままのため。

- [ ] **Step 3: ローカル `ComposeButton` を削除する**

`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` の 252-258行目付近にあるローカル定義を丸ごと削除する:

```tsx
function ComposeButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button variant="accent" size="pill" onClick={onClick}>
      {label}
    </Button>
  )
}
```

- [ ] **Step 4: `VerseView` を実装する**

同ファイルの `VerseView` を変更する。

まず `const bilingual = useBilingualEnabled()` の直前に `isMobile` を追加する。変更前（307行目付近）:

```tsx
  const bilingual = useBilingualEnabled()
```

変更後:

```tsx
  const isMobile = useIsMobile()
  const bilingual = useBilingualEnabled()
```

次に `PageHeader` の `title` から絵文字を落とし、`action` から投稿ボタンを外す。変更前（317-328行目付近）:

```tsx
      <PageHeader
        title={`📖 ${scriptureLabel}`}
        backTo="/scriptures/$collection/$book/$chapter"
        backLabel={book.isFrontMatter ? book.name : `第${chapter}章`}
        action={
          <div className="flex items-center gap-2">
            {canCompose && <ComposeButton onClick={() => setSheetOpen(true)} label="投稿する" />}
            <BilingualToggleButton />
            <BookmarkButton loc={loc} />
          </div>
        }
      />
```

変更後:

```tsx
      <PageHeader
        title={scriptureLabel}
        backTo="/scriptures/$collection/$book/$chapter"
        backLabel={book.isFrontMatter ? book.name : `第${chapter}章`}
        action={
          <div className="flex items-center gap-2">
            {canCompose && !isMobile && (
              <ComposePostButton label="投稿する" onClick={() => setSheetOpen(true)} />
            )}
            <BilingualToggleButton />
            <BookmarkButton loc={loc} />
          </div>
        }
      />
      {canCompose && isMobile && (
        <ComposePostButton layout="fab" label="投稿する" onClick={() => setSheetOpen(true)} />
      )}
```

`ComposePostButton` は `PageHeader` の**兄弟**として置くこと。`action` の中に入れると `backdrop-filter` により固定配置がヘッダー基準になる。

- [ ] **Step 5: インポートを整理する**

`ComposePostButton` を `@/shared/ui` からのインポートに追加する。変更前（9行目）:

```tsx
import { EmptyState, PageHeader, ScriptureText } from '@/shared/ui'
```

変更後:

```tsx
import { ComposePostButton, EmptyState, PageHeader, ScriptureText } from '@/shared/ui'
```

`Button`（10行目の `import { Button } from '@/shared/ui/button'`）がこのファイルで他に使われていなければ、その import 行も削除する。使われているかは次で確認する:

Run: `grep -n "<Button" "apps/pwa/src/pages/scriptures/\$collection/\$book/\$chapter.tsx"`

出力が空なら 10行目の `import { Button } from '@/shared/ui/button'` を削除する。

- [ ] **Step 6: テストを実行して通過を確認する**

Run: `pnpm test`

Expected: PASS（全ファイル全件）。既存の `未ログインの節表示では投稿導線を表示しない` と `選択中でも「章に投稿」は節指定なしでシートを開く`（composer 内の見出し `📖 第1ニーファイ書 第1章` を検証している。この絵文字は `PostComposerSheet` 側のもので今回の変更対象ではない）が引き続き通ることを確認する。

- [ ] **Step 7: 型チェックとビルドを確認する**

Run: `pnpm build`

Expected: 成功。未使用インポートによる型エラーが出ないこと。

- [ ] **Step 8: コミット**

```bash
git add apps/pwa/src/pages/scriptures/\$collection/\$book/\$chapter.tsx apps/pwa/tests/pages/scriptures/chapter.test.tsx
git commit -m "feat: 節ページの投稿導線を FAB に統合し絵文字を落とす"
```

---

## Task 6: 実機確認と設計書のステータス更新

自動テストでは FAB の実際の位置・重なりを検証できないため、ブラウザで確認する。

**Files:**
- Modify: `docs/superpowers/specs/2026-08-07-mobile-chapter-header-design.md`

**Interfaces:**
- Consumes: Task 3・4・5 の成果
- Produces: なし

- [ ] **Step 1: 開発サーバーを起動する**

Run: `pnpm dev`

ブラウザで `http://localhost:3000/scriptures/bofm/1-ne/1` を開き、開発者ツールでモバイル幅（375px）にする。

- [ ] **Step 2: 章ページを目視で確認する**

以下をすべて満たすこと:

- ヘッダーが `‹ 第1ニーファイ書` / `第1章` / 🌐 / 🔖 の1行に収まり、タイトルが `…` で切れていない
- 投稿 FAB が画面右下、BottomNav の上に浮いている
- FAB を押すと「章全体に投稿」「節を選んで投稿」のボトムシートが開く
- 「節を選んで投稿」で選択モードに入ると FAB が消える。キャンセルすると戻る
- ページを縦にスクロールしても FAB が同じ位置に留まる（ヘッダーと一緒にスクロールしない）

- [ ] **Step 3: 節ページを目視で確認する**

`http://localhost:3000/scriptures/bofm/1-ne/1?verses=1` を開き、以下を確認する:

- タイトルが `第1ニーファイ書 1:1` で、先頭に 📖 が付いていない
- FAB を押すと2択メニューを挟まず投稿シートが直接開く

- [ ] **Step 4: デスクトップ幅を確認する**

ウィンドウ幅を 1280px に広げ、章ページと節ページの両方で以下を確認する:

- 投稿ボタンがヘッダー内のピルとして表示される
- FAB が表示されていない

- [ ] **Step 5: 設計書のステータスを更新する**

`docs/superpowers/specs/2026-08-07-mobile-chapter-header-design.md` の3行目を変更する。

変更前:

```markdown
- ステータス: 設計完了（未実装）
```

変更後:

```markdown
- ステータス: 実装完了（ブランチ mobile-chapter-header）
```

- [ ] **Step 6: コミット**

```bash
git add docs/superpowers/specs/2026-08-07-mobile-chapter-header-design.md
git commit -m "docs: モバイル章ページヘッダー整理の設計を実装完了状態に更新する"
```
