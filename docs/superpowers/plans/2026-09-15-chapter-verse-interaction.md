# 章画面の節まわりの操作モデル 再設計 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 章画面の読書モードで、節に関する操作を「行タップ 1 つ」に集約し、節コメントシートをその節の面に育てる。

**Architecture:** 節コメントシート（非モーダルの Drawer）を、節本文・コピー・公式サイトリンク・投稿導線を持つ「その節の面」に育てる。そのうえで節の行を `Link`（節詳細へ遷移）から `button`（シートを開く）に変え、右の印をボタンから非対話の目印へ降格する。これにより 400ms の長押しゲートと、印とシートで塗りの所有権を奪い合うコードが丸ごと不要になる。

**Tech Stack:** TanStack Start / React 19 / TypeScript / TailwindCSS v4 / Base UI 由来の Drawer / Vitest + @testing-library/react / sonner

**Spec:** `docs/superpowers/specs/2026-09-15-chapter-verse-interaction-design.md`

## Global Constraints

- FSD のインポート規則を守る。`pages → widgets → features → entities → shared` の向きのみ。スライス内部への直接 import は禁止で、外からは必ず `index.ts` 経由
- 新規スライスを作ったら `index.ts` を必ず作る
- コメントは原則不要。WHY が自明でない場合のみ 1 行
- UI コンポーネントは TDD（失敗するテスト → 実装 → 通過）
- コンポーネントのテストは `apps/pwa/tests/` 下に、`src/` と同じ階層で置く
- テストは `pnpm --filter @manna/pwa test`。push 前に必ず通常の `test` を通す。書き込み不可の環境では `test:sandbox`
- CI には `.env.local` が無い。CI と同じ条件で確かめるときは
  `VITE_SUPABASE_URL=http://127.0.0.1:55321 VITE_SUPABASE_KEY=ci-dummy-key pnpm --filter @manna/pwa test`
- 型チェックは `pnpm --filter @manna/pwa typecheck`
- `DOMParser` と `navigator.clipboard` はブラウザ専用。SSR（Cloudflare Workers）には DOM が無いため、描画中ではなくイベントハンドラの中でのみ呼ぶ
- ブランチは 2 本に分ける想定だった（Task 1〜4 と Task 5〜7）が、**実施時は 1 本にまとめた**。最終レビューの修正が両方のファイルにまたがったため。マージ前に Codex レビューと CI を通すのは計画どおり

---

## File Structure

| ファイル | 責務 | 変更 |
|---|---|---|
| `apps/pwa/src/entities/scripture/lib/verseText.ts` | `text_html` からルビを落としたプレーンテキストを作る | 新規 |
| `apps/pwa/src/entities/scripture/index.ts` | 公開 API | `verseHtmlToPlainText` を追加 |
| `apps/pwa/src/shared/lib/clipboard.ts` | クリップボードへの書き込み（失敗を握って真偽値で返す） | 新規 |
| `apps/pwa/src/widgets/verse-comment-sheet/ui/VerseCommentSheet.tsx` | その節の面（本文・コピー・公式リンク・投稿・コメント一覧） | 大幅追加 |
| `apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx` | 節 1 行の描画と操作 | 読書モードを `button` へ |
| `apps/pwa/src/features/select-verse-view/ui/VerseCommentMarker.tsx` | 節の右に出る非対話の目印 | `VerseCommentGutter.tsx` を置き換え |
| `apps/pwa/src/features/select-verse-view/index.ts` | 公開 API | 差し替え |
| `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` | 章画面の配線 | 行タップ・塗り・シートを開く条件 |

---

## Task 1: text_html からプレーンテキストを作る

**Files:**
- Create: `apps/pwa/src/entities/scripture/lib/verseText.ts`
- Modify: `apps/pwa/src/entities/scripture/index.ts`
- Test: `apps/pwa/tests/entities/scripture/verseText.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `verseHtmlToPlainText(html: string): string`

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/entities/scripture/verseText.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { verseHtmlToPlainText } from '@/entities/scripture'

describe('verseHtmlToPlainText', () => {
  it('ルビを落として本文だけを返す', () => {
    const html = '<ruby>両<rt>りょう</rt></ruby><ruby>親<rt>しん</rt></ruby>から'
    expect(verseHtmlToPlainText(html)).toBe('両親から')
  })

  it('ルビ非対応ブラウザ向けの括弧（rp）も落とす', () => {
    const html = '<ruby>父<rp>（</rp><rt>ちち</rt><rp>）</rp></ruby>が'
    expect(verseHtmlToPlainText(html)).toBe('父が')
  })

  it('タグの無い本文はそのまま返す', () => {
    expect(verseHtmlToPlainText('わたしニーファイは')).toBe('わたしニーファイは')
  })

  it('前後の空白を落とす', () => {
    expect(verseHtmlToPlainText('  本文  ')).toBe('本文')
  })

  it('空文字は空文字を返す', () => {
    expect(verseHtmlToPlainText('')).toBe('')
  })
})
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm --filter @manna/pwa test verseText`
Expected: FAIL（`verseHtmlToPlainText` が `@/entities/scripture` から export されていない）

- [ ] **Step 3: 実装する**

`apps/pwa/src/entities/scripture/lib/verseText.ts`:

```ts
// text_html にはルビが入っている。剥がさずに textContent を取ると
// 「漢字かんじ」と二重に出る。innerHTML は使わず DOMParser で解析する
// （ブラウザ専用。SSR には DOM が無いのでイベントハンドラからのみ呼ぶ）
export function verseHtmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const el of doc.querySelectorAll('rt, rp')) el.remove()
  return doc.body.textContent?.trim() ?? ''
}
```

`apps/pwa/src/entities/scripture/index.ts` の末尾に追加:

```ts
export { verseHtmlToPlainText } from './lib/verseText'
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm --filter @manna/pwa test verseText`
Expected: PASS（5 件）

- [ ] **Step 5: コミット**

```bash
git add apps/pwa/src/entities/scripture/lib/verseText.ts \
        apps/pwa/src/entities/scripture/index.ts \
        apps/pwa/tests/entities/scripture/verseText.test.ts
git commit -m "feat: 節本文からルビを落としたプレーンテキストを作る"
```

---

## Task 2: クリップボードへの書き込み

**Files:**
- Create: `apps/pwa/src/shared/lib/clipboard.ts`
- Test: `apps/pwa/tests/shared/lib/clipboard.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `copyText(text: string): Promise<boolean>`（成功なら `true`）

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/shared/lib/clipboard.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { copyText } from '@/shared/lib/clipboard'

function stubClipboard(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard')
})

describe('copyText', () => {
  it('書き込めたら true を返す', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(writeText)

    await expect(copyText('第1ニーファイ書 1:3')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('第1ニーファイ書 1:3')
  })

  it('拒否されたら false を返す（例外は投げない）', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')))

    await expect(copyText('本文')).resolves.toBe(false)
  })

  it('クリップボードが無い環境では false を返す', async () => {
    await expect(copyText('本文')).resolves.toBe(false)
  })
})
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm --filter @manna/pwa test clipboard`
Expected: FAIL（`@/shared/lib/clipboard` が無い）

- [ ] **Step 3: 実装する**

`apps/pwa/src/shared/lib/clipboard.ts`:

```ts
// secure context でないと navigator.clipboard 自体が生えない。
// 呼び出し側は結果で通知を出し分けるので、ここでは例外を外に出さない
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm --filter @manna/pwa test clipboard`
Expected: PASS（3 件）

- [ ] **Step 5: コミット**

```bash
git add apps/pwa/src/shared/lib/clipboard.ts apps/pwa/tests/shared/lib/clipboard.test.ts
git commit -m "feat: クリップボードへの書き込みを共有ユーティリティにする"
```

---

## Task 3: シートに節本文・コピー・公式サイトリンクを出す

**Files:**
- Modify: `apps/pwa/src/widgets/verse-comment-sheet/ui/VerseCommentSheet.tsx`
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx`（`activeVerseSheet` の組み立て）
- Test: `apps/pwa/tests/widgets/verse-comment-sheet/VerseCommentSheet.test.tsx`

**Interfaces:**
- Consumes: `verseHtmlToPlainText`（Task 1）、`copyText`（Task 2）
- Produces: `VerseCommentSheet` の props

```ts
type Props = {
  open: boolean
  verse: number
  label: string          // 例: 第1ニーファイ書 1:3
  officialUrl: string
  textHtml?: string
  textHtmlSecondary?: string
  secondaryLang?: string
  posts: PostWithUser[]
  onOpenChange: (open: boolean) => void
  onHighlight?: (verses: number[] | null) => void
}
```

`label` と `officialUrl` は呼び出し側（章ページ）が `getScriptureLabel` / `buildScriptureUrl` で作って渡す。widget に `Book` を持ち込まないため。

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/widgets/verse-comment-sheet/VerseCommentSheet.test.tsx` の末尾に追加（既存の `posts` 定数と `renderInRouter` ヘルパをそのまま使う）:

```ts
describe('VerseCommentSheet の節の面', () => {
  const base = {
    open: true as const,
    verse: 7,
    label: '第1ニーファイ書 3:7',
    officialUrl: 'https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=jpn&id=p7#p7',
    posts,
    onOpenChange: () => {},
  }

  it('節本文を出す', async () => {
    renderInRouter(<VerseCommentSheet {...base} textHtml="わたしニーファイは" />)

    expect(await screen.findByText('わたしニーファイは')).toBeInTheDocument()
  })

  it('参照＋本文をクリップボードに入れる', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    renderInRouter(
      <VerseCommentSheet
        {...base}
        textHtml="<ruby>両<rt>りょう</rt></ruby>親から"
      />,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'コピー' }))

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('第1ニーファイ書 3:7\n両親から'),
    )
    Reflect.deleteProperty(navigator, 'clipboard')
  })

  it('公式サイトへのリンクを出す', async () => {
    renderInRouter(<VerseCommentSheet {...base} textHtml="本文" />)

    const link = await screen.findByRole('link', { name: /公式サイトで読む/ })
    expect(link).toHaveAttribute('href', base.officialUrl)
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('本文が未着ならコピーボタンを出さない', async () => {
    renderInRouter(<VerseCommentSheet {...base} />)

    await screen.findByText(/この節に関わる投稿/)
    expect(screen.queryByRole('button', { name: 'コピー' })).toBeNull()
  })
})
```

`SanitizedVerseHtml` は mount 後に `innerHTML` を差し込むため、本文の検証は `findByText` を使う（同期の `getByText` では取れない）。

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm --filter @manna/pwa test VerseCommentSheet`
Expected: FAIL（`label` 等の props が無く、本文もコピーボタンも描画されない）

- [ ] **Step 3: シートを実装する**

`apps/pwa/src/widgets/verse-comment-sheet/ui/VerseCommentSheet.tsx` の `Props` と本体を差し替える。`DrawerTitle` は `label` に変え、件数は投稿一覧の見出しへ移す:

```tsx
import { useEffect, useRef, useState } from 'react'
import { Copy, ExternalLink } from 'lucide-react'
import { CompactPostCard, type PostWithUser } from '@/entities/post'
import { verseHtmlToPlainText } from '@/entities/scripture'
import { copyText } from '@/shared/lib/clipboard'
import { SanitizedVerseHtml } from '@/shared/ui'
import { Button } from '@/shared/ui/button'
import { toast } from '@/shared/ui/sonner'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/ui/drawer'
import { useIsMobile } from '@/shared/hooks/use-mobile'

type Props = {
  open: boolean
  verse: number
  label: string
  officialUrl: string
  textHtml?: string
  textHtmlSecondary?: string
  secondaryLang?: string
  posts: PostWithUser[]
  onOpenChange: (open: boolean) => void
  onHighlight?: (verses: number[] | null) => void
}
```

`DrawerBody` の中身を次の順に組む（既存の投稿一覧はそのまま最後に置く）:

```tsx
<DrawerHeader>
  <DrawerTitle>{label}</DrawerTitle>
</DrawerHeader>
<DrawerBody className="flex flex-col gap-3 px-4 pb-4 max-h-[70vh]">
  {textHtml && (
    <div className="flex flex-col gap-2">
      <div className="text-sm">
        <SanitizedVerseHtml html={textHtml} style={{ color: 'var(--sea-ink)' }} />
        {textHtmlSecondary && (
          <SanitizedVerseHtml
            html={textHtmlSecondary}
            className="block mt-1"
            style={{ color: 'var(--sea-ink-soft)' }}
            lang={secondaryLang}
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={onCopy}>
          <Copy size={14} aria-hidden="true" />
          コピー
        </Button>
        <a
          href={officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm underline"
          style={{ color: 'var(--lagoon-deep)' }}
        >
          公式サイトで読む
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      </div>
    </div>
  )}
  <p className="text-xs font-medium" style={{ color: 'var(--sea-ink-soft)' }}>
    この節に関わる投稿 {posts.length}件
  </p>
  {/* 既存の posts.map(...) をここに置く */}
</DrawerBody>
```

`onCopy` はコンポーネント内に置く:

```tsx
const onCopy = async () => {
  if (!textHtml) return
  const ok = await copyText(`${label}\n${verseHtmlToPlainText(textHtml)}`)
  if (ok) toast('コピーしました')
  else toast.error('コピーできませんでした')
}
```

- [ ] **Step 4: 章ページから新しい props を渡す**

`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` の `activeVerseSheet` を差し替える:

```tsx
const activeVerseSheet =
  commentVerseForScroll !== undefined ? (
    <VerseCommentSheet
      open
      verse={commentVerseForScroll}
      label={getScriptureLabel({ ...loc, verses: [commentVerseForScroll] }, book)}
      officialUrl={buildScriptureUrl({ ...loc, verses: [commentVerseForScroll] }, book)}
      textHtml={verseTextMap.get(commentVerseForScroll)}
      textHtmlSecondary={secondaryTexts.get(commentVerseForScroll)}
      secondaryLang={SECONDARY_LANGUAGE}
      posts={sheetIndex.get(commentVerseForScroll)?.covered ?? []}
      onOpenChange={(open) => {
        if (!open) closeVerseSheet()
      }}
      onHighlight={setSheetHighlight}
    />
  ) : null
```

`getScriptureLabel` と `buildScriptureUrl` は既に import 済み。

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm --filter @manna/pwa test VerseCommentSheet chapter`
Expected: PASS。既存のシートのテストがタイトル文言（`📖 7節のコメント 2件`）を見ている場合は、`第1ニーファイ書 3:7` と「この節に関わる投稿 2件」に合わせて直す

- [ ] **Step 6: 型と全テスト**

Run: `pnpm --filter @manna/pwa typecheck && pnpm --filter @manna/pwa test`
Expected: どちらも PASS

- [ ] **Step 7: コミット**

```bash
git add apps/pwa/src/widgets/verse-comment-sheet apps/pwa/src/pages apps/pwa/tests
git commit -m "feat: 節コメントシートに節本文とコピー・公式サイトリンクを出す"
```

---

## Task 4: シートから投稿を始められるようにする

**Files:**
- Modify: `apps/pwa/src/widgets/verse-comment-sheet/ui/VerseCommentSheet.tsx`
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx`
- Test: `apps/pwa/tests/widgets/verse-comment-sheet/VerseCommentSheet.test.tsx`

**Interfaces:**
- Consumes: Task 3 の `VerseCommentSheet`
- Produces: `canCompose?: boolean`（既定 `false`）、`onCompose?: (verse: number) => void` を追加した `VerseCommentSheet`

- [ ] **Step 1: 失敗するテストを書く**

同ファイルの `describe('VerseCommentSheet の節の面')` に追加:

```ts
it('投稿できるなら「この節に投稿する」を出し、節番号つきで通知する', async () => {
  const onCompose = vi.fn()
  renderInRouter(
    <VerseCommentSheet {...base} textHtml="本文" canCompose onCompose={onCompose} />,
  )

  fireEvent.click(await screen.findByRole('button', { name: 'この節に投稿する' }))

  expect(onCompose).toHaveBeenCalledWith(7)
})

it('投稿が 0 件でも投稿ボタンは出る', async () => {
  renderInRouter(
    <VerseCommentSheet {...base} posts={[]} textHtml="本文" canCompose onCompose={() => {}} />,
  )

  expect(await screen.findByRole('button', { name: 'この節に投稿する' })).toBeInTheDocument()
  expect(screen.getByText('この節への投稿はまだありません')).toBeInTheDocument()
})

it('未ログインでは投稿ボタンを出さない', async () => {
  renderInRouter(<VerseCommentSheet {...base} textHtml="本文" />)

  await screen.findByText(/この節に関わる投稿/)
  expect(screen.queryByRole('button', { name: 'この節に投稿する' })).toBeNull()
})
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm --filter @manna/pwa test VerseCommentSheet`
Expected: FAIL（`canCompose` / `onCompose` が無い）

- [ ] **Step 3: シートに投稿導線を足す**

`Props` に追加:

```ts
  canCompose?: boolean
  onCompose?: (verse: number) => void
```

`DrawerBody` の投稿一覧の直後（末尾）に置く。空のときの文言も足す:

```tsx
{posts.length === 0 && (
  <p className="text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
    この節への投稿はまだありません
  </p>
)}
{canCompose && onCompose && (
  <Button type="button" variant="accent" className="w-full" onClick={() => onCompose(verse)}>
    この節に投稿する
  </Button>
)}
```

- [ ] **Step 4: 章ページで投稿シートにつなぐ**

`ChapterView` に投稿開始のハンドラを足す。節シートはモーダルでないため、先に閉じてから投稿シートを開く:

```tsx
const composeForVerse = (verse: number) => {
  closeVerseSheet()
  setComposerVerses([verse])
  setSheetOpen(true)
}
```

`activeVerseSheet` の `VerseCommentSheet` に渡す:

```tsx
      canCompose={canCompose}
      onCompose={composeForVerse}
```

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm --filter @manna/pwa test VerseCommentSheet chapter`
Expected: PASS

- [ ] **Step 6: 型と全テスト、コミット**

```bash
pnpm --filter @manna/pwa typecheck
VITE_SUPABASE_URL=http://127.0.0.1:55321 VITE_SUPABASE_KEY=ci-dummy-key pnpm --filter @manna/pwa test
git add apps/pwa/src apps/pwa/tests
git commit -m "feat: 節コメントシートからその節への投稿を始められるようにする"
```

（当初はここで 1 本目の PR を出す想定だった。実施時は分割せず、全タスク完了後にまとめて 1 本で出した）

---

## Task 5: シートを章の範囲内の任意の節で開けるようにする

ここから後半。ブランチは `feat/verse-row-opens-sheet`。

**Files:**
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx:609-616`（`commentVerseForScroll` の導出）
- Test: `apps/pwa/tests/pages/scriptures/chapter.test.tsx`

**Interfaces:**
- Consumes: Task 4 までの `VerseCommentSheet`
- Produces: なし（章ページ内部の条件変更）

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/pages/scriptures/chapter.test.tsx` に追加（既存の `render` ヘルパと `createSupabaseQueryChain` を使う。近傍の `?comment=` を扱うテストの書き方に合わせる）:

このファイルは、モジュール先頭の `search` 変数と `loaderData` をテストごとに差し替えてから `render(<ChapterPage />)` する形になっている。`baseChapterData` は `1-ne`（第1ニーファイ書）第1章・`verses: [20]`（＝20節まで）・`circlePosts: []` なので、そのまま使える。

```ts
it('コメントが無い節でも ?comment= でシートが開く', async () => {
  loaderData = { ...baseChapterData }
  search = { comment: 2 }

  render(<ChapterPage />)

  expect(await screen.findByText('第1ニーファイ書 1:2')).toBeInTheDocument()
  expect(screen.getByText('この節への投稿はまだありません')).toBeInTheDocument()
})

it('章の範囲外の ?comment= ではシートを開かない', async () => {
  loaderData = { ...baseChapterData }
  search = { comment: 9999 }

  render(<ChapterPage />)

  await screen.findByText('一節の本文')
  expect(screen.queryByText(/この節に関わる投稿/)).toBeNull()
})
```

`search` の型注釈（`let search: { select?: number[]; mode?: 'select'; comment?: number }`）は既に `comment` を持っているので変更不要。

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm --filter @manna/pwa test chapter`
Expected: FAIL（コメントの無い節ではシートが開かない）

- [ ] **Step 3: 条件を緩める**

`commentVerseForScroll` の導出を、コメントの有無ではなく章の範囲で判定する形に変える:

```tsx
  // インデックスは章の範囲外の節を持たないが、コメントが無い節でも開ける。
  // 節の行からこのシートを開くようになったため
  const requestedComment = search.comment
  const commentVerseForScroll =
    mode !== 'select' &&
    requestedComment !== undefined &&
    requestedComment >= 1 &&
    requestedComment <= maxVerse
      ? requestedComment
      : undefined
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm --filter @manna/pwa test chapter`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add apps/pwa/src/pages apps/pwa/tests/pages
git commit -m "feat: コメントの無い節でも節シートを開けるようにする"
```

---

## Task 6: 節の行タップでシートを開く

**Files:**
- Modify: `apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx`
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx`（`verseList` と `ChapterPreview`）
- Test: `apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx`

**Interfaces:**
- Consumes: Task 5 の緩めた開閉条件
- Produces: `VerseRow` の props に `onOpen: (verse: number) => void` と `commentCount?: number` を追加。`mode='read'` はリンクではなくボタンになる

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx`。既存の `it("mode='read' で節番号と本文を表示し、リンクとして機能する")` と `describe('VerseRow preload')` は契約が変わるので削除し、代わりに置く:

```ts
it("mode='read' でタップすると onOpen が呼ばれ、遷移しない", async () => {
  const onOpen = vi.fn()
  const chapterLoader = vi.fn()
  renderInRouter(
    <VerseRow
      collection="bofm"
      book="1-ne"
      chapter={3}
      verse={7}
      textHtml="本文"
      mode="read"
      selected={false}
      onSelect={() => {}}
      onOpen={onOpen}
    />,
    { chapterLoader },
  )

  await userEvent.click(await screen.findByRole('button'))

  expect(onOpen).toHaveBeenCalledWith(7)
  expect(chapterLoader).not.toHaveBeenCalled()
  expect(screen.queryByRole('link')).toBeNull()
})

it("mode='read' でコメント件数を読み上げに残す", async () => {
  renderInRouter(
    <VerseRow
      collection="bofm"
      book="1-ne"
      chapter={3}
      verse={7}
      textHtml="本文"
      mode="read"
      selected={false}
      onSelect={() => {}}
      onOpen={() => {}}
      commentCount={3}
    />,
  )

  expect(await screen.findByText('コメント3件')).toBeInTheDocument()
})

it("mode='read' でコメントが無ければ件数を出さない", async () => {
  renderInRouter(
    <VerseRow
      collection="bofm"
      book="1-ne"
      chapter={3}
      verse={7}
      textHtml="本文"
      mode="read"
      selected={false}
      onSelect={() => {}}
      onOpen={() => {}}
      commentCount={0}
    />,
  )

  await screen.findByRole('button')
  expect(screen.queryByText(/コメント/)).toBeNull()
})
```

残りの既存テスト（併記・`showNumber`・`highlighted`・明朝体）は `mode='read'` で `onOpen={() => {}}` を足すだけで通るようにする。

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm --filter @manna/pwa test VerseRow`
Expected: FAIL（`onOpen` が無く、読書モードは依然 `link`）

- [ ] **Step 3: 読書モードをボタンにする**

`Props` に追加:

```ts
  onOpen: (verse: number) => void
  commentCount?: number
```

末尾の `return`（`mode === 'select'` でない側）を差し替える。`Link` の import は不要になるので削る:

```tsx
  return (
    <div style={containerStyle} data-highlighted={highlighted || undefined}>
      <button
        type="button"
        onClick={() => onOpen(verse)}
        aria-haspopup="dialog"
        className="verse-item block w-full text-left"
        data-bilingual={textHtmlSecondary ? '' : undefined}
      >
        {inner}
        {commentCount > 0 && <span className="sr-only">コメント{commentCount}件</span>}
      </button>
    </div>
  )
```

`commentCount` は既定値 `0` で分割代入する（`commentCount = 0`）。

- [ ] **Step 4: 章ページから配線する**

`verseList` の `VerseRow` に渡す:

```tsx
                  onOpen={openVerseSheet}
                  commentCount={entry?.covered.length ?? 0}
```

`ChapterPreview` の `VerseRow`（プレビューは `inert` で触れないが props は要る）に追加:

```tsx
                    onOpen={() => {}}
```

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm --filter @manna/pwa test VerseRow chapter`
Expected: PASS。章ページ側で「節をタップすると節詳細へ遷移する」ことを見ている既存テストがあれば、「シートが開く」に直す

- [ ] **Step 6: 型と全テスト、コミット**

```bash
pnpm --filter @manna/pwa typecheck
VITE_SUPABASE_URL=http://127.0.0.1:55321 VITE_SUPABASE_KEY=ci-dummy-key pnpm --filter @manna/pwa test
git add apps/pwa/src apps/pwa/tests
git commit -m "feat: 節の行タップで節シートを開く"
```

---

## Task 7: 印を非対話の目印に降格する

**Files:**
- Create: `apps/pwa/src/features/select-verse-view/ui/VerseCommentMarker.tsx`
- Delete: `apps/pwa/src/features/select-verse-view/ui/VerseCommentGutter.tsx`
- Delete: `apps/pwa/tests/features/select-verse-view/VerseCommentGutter.test.tsx`
- Create: `apps/pwa/tests/features/select-verse-view/VerseCommentMarker.test.tsx`
- Modify: `apps/pwa/src/features/select-verse-view/index.ts`
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx`

**Interfaces:**
- Consumes: Task 6 の行タップ
- Produces:

```ts
export const VERSE_MARKER_WIDTH = 'w-6 lg:w-14'
export type VerseMarkerEntry = {
  anchoredCount: number
  commenters: AvatarStackItem[]
}
export function VerseCommentMarker(props: { entry: VerseMarkerEntry | undefined }): JSX.Element
```

`verse` / `onOpen` / `onHighlight` / `highlightVerses` は持たない。

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/features/select-verse-view/VerseCommentMarker.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VerseCommentMarker } from '@/features/select-verse-view'

const alice = { userId: 'u1', name: 'アリス', avatarUrl: null }
const bob = { userId: 'u2', name: 'ボブ', avatarUrl: null }

describe('VerseCommentMarker', () => {
  it('押せる要素を描画しない', () => {
    render(<VerseCommentMarker entry={{ anchoredCount: 1, commenters: [alice] }} />)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('アンカー節では投稿者アバターを描画する', () => {
    render(<VerseCommentMarker entry={{ anchoredCount: 1, commenters: [alice] }} />)

    expect(screen.getByText('ア')).toBeInTheDocument()
  })

  it('2件以上なら件数バッジを出す', () => {
    render(<VerseCommentMarker entry={{ anchoredCount: 2, commenters: [alice, bob] }} />)

    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('コメントのない節では幅だけ確保する', () => {
    const { container } = render(<VerseCommentMarker entry={undefined} />)

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
    expect(screen.queryByText('ア')).toBeNull()
  })
})
```

アバターの頭文字が「ア」でない場合は、既存の `VerseCommentGutter.test.tsx` がアバターをどう検証していたかに合わせる。

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm --filter @manna/pwa test VerseCommentMarker`
Expected: FAIL（`VerseCommentMarker` が無い）

- [ ] **Step 3: 印を実装する**

`apps/pwa/src/features/select-verse-view/ui/VerseCommentMarker.tsx`:

```tsx
import { UserAvatar } from '@/shared/ui'
import type { AvatarStackItem } from '@/shared/ui'

const MAX_AVATARS = 3

// 節本文の右に確保する固定幅。件数が増えても行の高さが変わらないよう、
// 幅は常に一定で、中身だけが「印あり／なし」に切り替わる。
// lg は最大構成（24px アバター3枚の重ね = 56px）が収まる幅にする
export const VERSE_MARKER_WIDTH = 'w-6 lg:w-14'

export type VerseMarkerEntry = {
  anchoredCount: number
  commenters: AvatarStackItem[]
}

// 目印であって操作子ではない。節に関する操作は行全体のタップに集約している
export function VerseCommentMarker({ entry }: { entry: VerseMarkerEntry | undefined }) {
  if (!entry || entry.anchoredCount === 0) {
    return <div className={`${VERSE_MARKER_WIDTH} shrink-0`} aria-hidden="true" />
  }

  const avatars = entry.commenters.slice(0, MAX_AVATARS)

  return (
    <div className={`${VERSE_MARKER_WIDTH} shrink-0 self-stretch pt-3`} aria-hidden="true">
      <div className="relative flex w-fit items-center">
        {avatars.map((c, i) => (
          <span
            key={c.userId}
            className={i === 0 ? '' : '-ml-2 hidden lg:block'}
            style={{ zIndex: avatars.length - i }}
          >
            <UserAvatar name={c.name} url={c.avatarUrl} size="2xs" />
          </span>
        ))}
        {entry.anchoredCount >= 2 && (
          // 10px の小さい文字なのでコントラストは 4.5:1 が要る。白文字＋lagoon-deep
          // では 3.81 で足りず、lagoon 地に sea-ink の文字で 5.15 にしている。
          // アバターは flex アイテムに z-index を持つ（static でも効く）ので、
          // それより前に出さないとバッジが下に潜る
          <span
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-medium"
            style={{
              background: 'var(--lagoon)',
              color: 'var(--sea-ink)',
              zIndex: avatars.length + 1,
            }}
          >
            {entry.anchoredCount}
          </span>
        )}
      </div>
    </div>
  )
}
```

`apps/pwa/src/features/select-verse-view/index.ts` の該当行を差し替える:

```ts
export {
  VerseCommentMarker,
  VERSE_MARKER_WIDTH,
  type VerseMarkerEntry,
} from './ui/VerseCommentMarker'
```

古いファイルとテストを消す:

```bash
git rm apps/pwa/src/features/select-verse-view/ui/VerseCommentGutter.tsx \
       apps/pwa/tests/features/select-verse-view/VerseCommentGutter.test.tsx
```

- [ ] **Step 4: 章ページを配線し直す**

import を差し替え（`VerseCommentGutter` → `VerseCommentMarker`）、`verseList` の呼び出しを置き換える:

```tsx
              {showGutter && (
                <VerseCommentMarker
                  entry={
                    entry && {
                      anchoredCount: entry.anchored.length,
                      commenters: entry.commenters,
                    }
                  }
                />
              )}
```

塗りの持ち主がシートだけになるので、`gutterClaims` と `claimGutterHighlight` を削除し、`highlightedVerses` を単純化する:

```tsx
  // シートが開いている間だけ塗る。カードに触れていないときは、シートに出ている
  // 全コメントが指す節をまとめて塗る
  const highlightedVerses = useMemo(() => {
    if (commentVerseForScroll === undefined) return null
    if (sheetHighlight) return new Set(sheetHighlight)
    const covered = sheetIndex.get(commentVerseForScroll)?.covered ?? []
    const verses = covered.flatMap((p) => p.scripture_verses ?? [])
    return new Set(verses.length ? verses : [commentVerseForScroll])
  }, [commentVerseForScroll, sheetHighlight, sheetIndex])
```

`buildVerseCommentIndex` が返す `highlightVerses` は誰も使わなくなる。`verseCommentIndex.ts` からの削除は別の作業にせず、この時点では残す（他の利用が無いことを確認したうえで消しても良いが、消すならテストも合わせて直す）。

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm --filter @manna/pwa test`
Expected: PASS。章ページのテストで印をクリックしてシートを開いていたものは、節の行をクリックする形に直す

- [ ] **Step 6: 型と全テスト、コミット**

```bash
pnpm --filter @manna/pwa typecheck
VITE_SUPABASE_URL=http://127.0.0.1:55321 VITE_SUPABASE_KEY=ci-dummy-key pnpm --filter @manna/pwa test
git add -A apps/pwa
git commit -m "refactor: 節コメントの印を非対話の目印に降格する"
```

全タスク完了。1 本の PR にまとめて出す。

---

## 実機で見る項目（マージ前）

- 読んでいる最中の誤タップでシートが開く頻度が許せる範囲か
- 行がボタンになってもスワイプでの章移動が効くか
- コピーが iOS のホーム画面 PWA で通るか（`navigator.clipboard` は secure context 必須）
- 節シートから「この節に投稿する」を押したとき、投稿シートが開き、閉じたあと章に戻るか（履歴が 1 段で済んでいるか）

---

## Self-Review

**Spec coverage**

| spec の項目 | 対応するタスク |
|---|---|
| 行タップ＝シートを開く | Task 6 |
| 印を非対話に降格 | Task 7 |
| 長押しゲートの廃止 | Task 7（`VerseCommentGutter.tsx` ごと削除） |
| 節本文をシートに出す | Task 3 |
| コピー（参照＋本文、ルビを落とす） | Task 1・2・3 |
| 公式サイトリンクの移設 | Task 3 |
| この節に投稿する | Task 4 |
| シートを開く条件の緩和 | Task 5 |
| `gutterClaims` の削除と塗りの単純化 | Task 7 |
| アクセシビリティ（`aria-haspopup`、件数の読み上げ） | Task 6 |
| 出す順序（シートを育ててから行タップを切り替える） | Task 1〜4 / Task 5〜7 |

**残した判断**: `buildVerseCommentIndex` の `highlightVerses` は Task 7 の時点で未使用になるが、削除は任意とした。消すなら `verseCommentIndex.test.ts` も合わせて直す。

**互換性**: `?verses=` の節詳細画面（`VerseView`）は残す。投稿詳細 `apps/pwa/src/pages/posts/$id.tsx:100` がそこへリンクしている。
