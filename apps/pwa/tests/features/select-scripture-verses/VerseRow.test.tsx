import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
  const rootRoute = createRootRoute({
    component: () => <Outlet />,
    notFoundComponent: () => <div>404</div>,
  })
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
}

describe('VerseRow', () => {
  it("mode='read' で節番号と本文を表示し、リンクとして機能する", async () => {
    renderInRouter(
      <VerseRow {...baseProps} mode="read" selected={false} onSelect={vi.fn()} />,
    )
    await waitFor(() => {
      expect(screen.getByText('19')).toBeInTheDocument()
      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        expect.stringContaining('/scriptures/bofm/mosiah/3'),
      )
    })
  })

  it("mode='select' でクリックすると onSelect が呼ばれ、リンク遷移は起きない", async () => {
    const onSelect = vi.fn()
    renderInRouter(
      <VerseRow {...baseProps} mode="select" selected={false} onSelect={onSelect} />,
    )
    await waitFor(() => {
      expect(screen.queryByRole('link')).toBeNull()
      expect(screen.getByRole('checkbox', { name: '19節を選択' })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('checkbox', { name: '19節を選択' }))
    expect(onSelect).toHaveBeenCalledWith(19)
  })

  it("mode='select' かつ selected=true でチェックマークとアクセントを表示", async () => {
    renderInRouter(
      <VerseRow {...baseProps} mode="select" selected={true} onSelect={vi.fn()} />,
    )
    await waitFor(() => {
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toHaveAttribute('aria-checked', 'true')
    })
  })

})

describe('VerseRow commenterMarker', () => {
  const marker = { userId: 'u1', name: '中村さん', avatarUrl: null }

  it('commenterMarker があるとマーカーボタンを出し、押下で onMarkerClick を呼ぶ', async () => {
    const onMarkerClick = vi.fn()
    renderInRouter(
      <VerseRow
        {...baseProps}
        mode="read"
        selected={false}
        onSelect={vi.fn()}
        commenterMarker={marker}
        onMarkerClick={onMarkerClick}
      />,
    )
    const btn = await screen.findByRole('button', {
      name: '中村さん の 19節 コメントを見る',
    })
    await userEvent.click(btn)
    expect(onMarkerClick).toHaveBeenCalledWith(19)
  })

  it('commenterMarker 無しならマーカーは出さない', async () => {
    renderInRouter(
      <VerseRow {...baseProps} mode="read" selected={false} onSelect={vi.fn()} />,
    )
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /コメントを見る/ }),
      ).toBeNull()
    })
  })
})

describe('VerseRow showNumber', () => {
  it("showNumber=false のとき mode='read' で節番号を表示しない", async () => {
    renderInRouter(
      <VerseRow {...baseProps} mode="read" selected={false} onSelect={vi.fn()} showNumber={false} />,
    )
    await waitFor(() => {
      expect(screen.queryByText('19')).toBeNull()
    })
  })

  it("showNumber=false のとき mode='select' でも節番号を表示しない", async () => {
    renderInRouter(
      <VerseRow {...baseProps} mode="select" selected={false} onSelect={vi.fn()} showNumber={false} />,
    )
    await waitFor(() => {
      expect(screen.queryByText('19')).toBeNull()
      expect(screen.getByRole('checkbox', { name: '19節を選択' })).toBeInTheDocument()
    })
  })
})
