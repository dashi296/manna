import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { VerseCommentSheet } from '@/widgets/verse-comment-sheet'
import type { PostWithUser } from '@/entities/post'

const posts: PostWithUser[] = [
  {
    id: 'p1',
    content: '節7 への A の投稿',
    visibility: 'public',
    created_at: '2026-07-19T00:00:00.000Z',
    updated_at: '2026-07-19T00:00:00.000Z',
    scripture_collection: 'bofm',
    scripture_book: '1-ne',
    scripture_chapter: 3,
    scripture_verses: [7],
    user_id: 'u1',
    users: { display_name: '中村さん', avatar_url: null },
  },
  {
    id: 'p2',
    content: '節5-7 への B の投稿',
    visibility: 'public',
    created_at: '2026-07-18T00:00:00.000Z',
    updated_at: '2026-07-18T00:00:00.000Z',
    scripture_collection: 'bofm',
    scripture_book: '1-ne',
    scripture_chapter: 3,
    scripture_verses: [5, 6, 7],
    user_id: 'u2',
    users: { display_name: '田中さん', avatar_url: null },
  },
]

function renderInRouter(ui: React.ReactNode) {
  const root = createRootRoute({ component: () => <Outlet />, notFoundComponent: () => null })
  const index = createRoute({ getParentRoute: () => root, path: '/', component: () => <>{ui}</> })
  const postRoute = createRoute({
    getParentRoute: () => root,
    path: '/posts/$id',
    component: () => <div>post</div>,
  })
  const router = createRouter({
    routeTree: root.addChildren([index, postRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router} />)
}

describe('VerseCommentSheet', () => {
  it('open=true でヘッダーに節と件数を出す', async () => {
    renderInRouter(
      <VerseCommentSheet open={true} verse={7} posts={posts} onOpenChange={vi.fn()} />,
    )
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /7節.*2件/ })).toBeInTheDocument()
    })
  })

  it('その節に関わる投稿を投稿者を問わず並べる', async () => {
    renderInRouter(
      <VerseCommentSheet open={true} verse={7} posts={posts} onOpenChange={vi.fn()} />,
    )
    await waitFor(() => {
      expect(screen.getByText('節7 への A の投稿')).toBeInTheDocument()
      expect(screen.getByText('節5-7 への B の投稿')).toBeInTheDocument()
    })
  })

  it('複数節の投稿には範囲ラベルを出す', async () => {
    renderInRouter(
      <VerseCommentSheet open={true} verse={7} posts={posts} onOpenChange={vi.fn()} />,
    )
    await waitFor(() => {
      expect(screen.getByText(/3:5–7/)).toBeInTheDocument()
    })
  })

  it('カードにホバーするとその投稿の対象節を通知し、離れると解除する', async () => {
    const onHighlight = vi.fn()
    renderInRouter(
      <VerseCommentSheet
        open={true}
        verse={7}
        posts={posts}
        onOpenChange={vi.fn()}
        onHighlight={onHighlight}
      />,
    )

    // jsdom は要素の寸法を持たないため userEvent.hover は座標解決で別のカードにも
    // enter を発火してしまう。対象のカードへ直接イベントを送る
    const card = await screen.findByText('節5-7 への B の投稿')
    const wrapper = card.closest('a')!.parentElement!

    fireEvent.pointerOver(wrapper)
    expect(onHighlight).toHaveBeenLastCalledWith([5, 6, 7])

    fireEvent.pointerOut(wrapper)
    expect(onHighlight).toHaveBeenLastCalledWith(null)
  })

  it('カードに触れたままスクロールに移ってもハイライトが残らない', async () => {
    // 押したままスクロールに移ると pointerleave が来ず pointercancel だけが発生する
    const onHighlight = vi.fn()
    renderInRouter(
      <VerseCommentSheet
        open={true}
        verse={7}
        posts={posts}
        onOpenChange={vi.fn()}
        onHighlight={onHighlight}
      />,
    )

    const card = await screen.findByText('節5-7 への B の投稿')
    const wrapper = card.closest('a')!.parentElement!

    fireEvent.pointerOver(wrapper)
    expect(onHighlight).toHaveBeenLastCalledWith([5, 6, 7])

    fireEvent.pointerCancel(wrapper)

    expect(onHighlight).toHaveBeenLastCalledWith(null)
  })

  it('シートを閉じるときにハイライトを解除する', async () => {
    const onHighlight = vi.fn()
    const { rerender } = renderInRouter(
      <VerseCommentSheet
        open={true}
        verse={7}
        posts={posts}
        onOpenChange={vi.fn()}
        onHighlight={onHighlight}
      />,
    )
    await screen.findByText('節7 への A の投稿')

    onHighlight.mockClear()
    rerender(<div />)

    expect(onHighlight).toHaveBeenCalledWith(null)
  })

  it('モバイル幅では下シートで開く', async () => {
    // useIsMobile は effect でしか画面幅を反映しないため、初回描画をそのまま出すと
    // モバイルでも一度 side="right" で DOM に入る。実装側は幅が確定するまで描画を
    // 止めている（この後段の値だけでは初回描画の有無まで固定できない）
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 390 })
    renderInRouter(
      <VerseCommentSheet open={true} verse={7} posts={posts} onOpenChange={vi.fn()} />,
    )

    await waitFor(() => {
      expect(
        document.body.querySelector('[data-slot="drawer-content"]')?.getAttribute('data-side'),
      ).toBe('bottom')
    })
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
  })

  it('デスクトップ幅では右パネルで開く', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1440 })
    renderInRouter(
      <VerseCommentSheet open={true} verse={7} posts={posts} onOpenChange={vi.fn()} />,
    )

    await waitFor(() => {
      expect(
        document.body.querySelector('[data-slot="drawer-content"]')?.getAttribute('data-side'),
      ).toBe('right')
    })
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
  })

  it('開いている間もページのスクロールをロックしない', async () => {
    renderInRouter(
      <VerseCommentSheet open={true} verse={7} posts={posts} onOpenChange={vi.fn()} />,
    )
    await screen.findByText('節7 への A の投稿')

    expect(document.documentElement.style.overflowY).not.toBe('hidden')
    expect(document.body.style.overflowY).not.toBe('hidden')
  })

  it('章を覆うバックドロップを描画しない', async () => {
    renderInRouter(
      <VerseCommentSheet open={true} verse={7} posts={posts} onOpenChange={vi.fn()} />,
    )
    await screen.findByText('節7 への A の投稿')

    expect(document.body.querySelector('[data-slot="drawer-overlay"]')).toBeNull()
    expect(document.body.querySelector('[data-slot="sheet-overlay"]')).toBeNull()
  })

  it('open=false では中身を出さない', () => {
    renderInRouter(
      <VerseCommentSheet open={false} verse={7} posts={posts} onOpenChange={vi.fn()} />,
    )
    expect(screen.queryByText('節7 への A の投稿')).toBeNull()
  })

  it('内側の投稿リスト container に max-h と overflow-y-auto を持つ', async () => {
    const { container } = renderInRouter(
      <VerseCommentSheet open={true} verse={7} posts={posts} onOpenChange={vi.fn()} />,
    )
    await waitFor(() => {
      const scroller = container.ownerDocument.body.querySelector(
        '[data-slot="drawer-content"] .max-h-\\[70vh\\]',
      )
      expect(scroller).not.toBeNull()
      expect(scroller?.className).toContain('overflow-y-auto')
    })
  })
})
