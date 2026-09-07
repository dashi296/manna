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

  it('本文に明朝体クラスを適用する', async () => {
    const { container } = renderInRouter(
      <VerseRow {...baseProps} mode="read" selected={false} onSelect={vi.fn()} />,
    )
    await waitFor(() => {
      expect(container.querySelector('span.font-scripture')).not.toBeNull()
    })
  })
})

describe('VerseRow highlighted', () => {
  it('highlighted=true で本文行に背景を敷く', async () => {
    const { container } = renderInRouter(
      <VerseRow
        {...baseProps}
        mode="read"
        selected={false}
        onSelect={vi.fn()}
        highlighted
      />,
    )
    await waitFor(() => {
      expect(screen.getByText('19')).toBeInTheDocument()
    })
    const row = container.querySelector('[data-highlighted="true"]')
    expect(row).not.toBeNull()
  })

  it('highlighted 未指定なら背景を敷かない', async () => {
    const { container } = renderInRouter(
      <VerseRow {...baseProps} mode="read" selected={false} onSelect={vi.fn()} />,
    )
    await waitFor(() => {
      expect(screen.getByText('19')).toBeInTheDocument()
    })
    expect(container.querySelector('[data-highlighted="true"]')).toBeNull()
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

describe('VerseRow bilingual', () => {
  it('textHtmlSecondary 指定時は lang 属性付きで第2言語テキストを表示する', async () => {
    const { container } = renderInRouter(
      <VerseRow
        {...baseProps}
        mode="read"
        selected={false}
        onSelect={vi.fn()}
        textHtmlSecondary="Home to the Lord is one way"
        secondaryLang="en"
      />,
    )
    await waitFor(() => {
      expect(screen.getByText('Home to the Lord is one way')).toBeInTheDocument()
    })
    expect(container.querySelector('[lang="en"]')).not.toBeNull()
  })

  it('textHtmlSecondary があっても節番号と日本語本文は同じ行に並ぶ', async () => {
    renderInRouter(
      <VerseRow
        {...baseProps}
        mode="read"
        selected={false}
        onSelect={vi.fn()}
        textHtmlSecondary="Home to the Lord is one way"
        secondaryLang="en"
      />,
    )
    await waitFor(() => {
      expect(screen.getByText('19')).toBeInTheDocument()
    })
    const numberSpan = screen.getByText('19')
    expect(numberSpan.nextElementSibling?.tagName).toBe('SPAN')
  })

  it('併記中は verse-item に data-bilingual を付ける', async () => {
    // 画面外の節の高さ見積もり（contain-intrinsic-size）を併記の有無で切り替えるため。
    // 見積もりがずれるとページ全体の高さと節へのスクロール位置が狂う
    const { container } = renderInRouter(
      <VerseRow
        {...baseProps}
        mode="read"
        selected={false}
        onSelect={vi.fn()}
        textHtmlSecondary="Home to the Lord is one way"
        secondaryLang="en"
      />,
    )

    await waitFor(() => {
      expect(container.querySelector('.verse-item')).toHaveAttribute('data-bilingual')
    })
  })

  it('併記していなければ data-bilingual を付けない', async () => {
    const { container } = renderInRouter(
      <VerseRow {...baseProps} mode="read" selected={false} onSelect={vi.fn()} />,
    )

    await waitFor(() => {
      expect(container.querySelector('.verse-item')).not.toHaveAttribute('data-bilingual')
    })
  })

  it('textHtmlSecondary が無ければ第2言語ブロックを描画しない', async () => {
    const { container } = renderInRouter(
      <VerseRow {...baseProps} mode="read" selected={false} onSelect={vi.fn()} />,
    )
    await waitFor(() => {
      expect(screen.getByText('19')).toBeInTheDocument()
    })
    expect(container.querySelector('[lang]')).toBeNull()
  })

  it('textHtmlSecondary が無ければ本文をdivで包まず、節番号と同じ行に並ぶ', async () => {
    renderInRouter(
      <VerseRow {...baseProps} mode="read" selected={false} onSelect={vi.fn()} />,
    )
    await waitFor(() => {
      expect(screen.getByText('19')).toBeInTheDocument()
    })
    const numberSpan = screen.getByText('19')
    expect(numberSpan.nextElementSibling?.tagName).toBe('SPAN')
  })
})
