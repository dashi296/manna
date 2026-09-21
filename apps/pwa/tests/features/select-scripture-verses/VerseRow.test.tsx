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
import { VerseRow } from '@/features/select-scripture-verses'

type RenderOptions = {
  chapterLoader?: (ctx: { params: { chapter: string } }) => void
}

function renderInRouter(ui: React.ReactNode, options: RenderOptions = {}) {
  const { chapterLoader } = options
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
    loader: chapterLoader,
    component: () => <div>chapter</div>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, chapterRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router} />)
}

const baseProps = {
  verse: 19,
  textHtml: '主のみもとに帰る道はただ一つ',
}

describe('VerseRow', () => {
  it("mode='read' でタップすると onOpen が呼ばれ、遷移しない", async () => {
    const onOpen = vi.fn()
    const chapterLoader = vi.fn()
    renderInRouter(
      <VerseRow
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

  it("mode='read' のボタンは aria-haspopup='dialog' を持つ", async () => {
    render(
      <VerseRow
        verse={7}
        textHtml="本文"
        mode="read"
        selected={false}
        onSelect={() => {}}
        onOpen={() => {}}
      />,
    )

    expect(await screen.findByRole('button')).toHaveAttribute('aria-haspopup', 'dialog')
  })

  it("mode='read' でコメント件数を視覚的に隠したテキストとして読み上げに残す", async () => {
    render(
      <VerseRow
        verse={7}
        textHtml="本文"
        mode="read"
        selected={false}
        onSelect={() => {}}
        onOpen={() => {}}
        commentCount={3}
      />,
    )

    const countText = await screen.findByText('コメント3件')
    expect(countText).toBeInTheDocument()
    expect(countText).toHaveClass('sr-only')
  })

  it("mode='read' でコメントが無ければ件数を出さない", async () => {
    render(
      <VerseRow
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

  it("mode='select' でクリックすると onSelect が呼ばれ、リンク遷移は起きない", async () => {
    const onSelect = vi.fn()
    render(
      <VerseRow
        {...baseProps}
        mode="select"
        selected={false}
        onSelect={onSelect}
        onOpen={() => {}}
      />,
    )
    await waitFor(() => {
      expect(screen.queryByRole('link')).toBeNull()
      expect(screen.getByRole('checkbox', { name: '19節を選択' })).toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('checkbox', { name: '19節を選択' }))
    expect(onSelect).toHaveBeenCalledWith(19)
  })

  it("mode='select' かつ selected=true でチェックマークとアクセントを表示", async () => {
    render(
      <VerseRow
        {...baseProps}
        mode="select"
        selected={true}
        onSelect={vi.fn()}
        onOpen={() => {}}
      />,
    )
    await waitFor(() => {
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toHaveAttribute('aria-checked', 'true')
    })
    // 地色と左帯は styles.css の verse-row が data-selected で出し分ける
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toHaveAttribute('data-selected')
    expect(checkbox.querySelector('.verse-check')).toHaveAttribute('data-selected')
  })

  it("mode='select' かつ selected=false なら data-selected を付けない", async () => {
    render(
      <VerseRow
        {...baseProps}
        mode="select"
        selected={false}
        onSelect={vi.fn()}
        onOpen={() => {}}
      />,
    )
    const checkbox = await screen.findByRole('checkbox')
    expect(checkbox).not.toHaveAttribute('data-selected')
    expect(checkbox.querySelector('.verse-check')).not.toHaveAttribute('data-selected')
  })

  it('本文に明朝体クラスを適用する', async () => {
    const { container } = render(
      <VerseRow {...baseProps} mode="read" selected={false} onSelect={vi.fn()} onOpen={() => {}} />,
    )
    await waitFor(() => {
      expect(container.querySelector('span.font-scripture')).not.toBeNull()
    })
  })
})

describe('VerseRow highlighted', () => {
  it('highlighted=true で本文行に背景を敷く', async () => {
    const { container } = render(
      <VerseRow
        {...baseProps}
        mode="read"
        selected={false}
        onSelect={vi.fn()}
        onOpen={() => {}}
        highlighted
      />,
    )
    await waitFor(() => {
      expect(screen.getByText('19')).toBeInTheDocument()
    })
    const row = container.querySelector('[data-highlighted="true"]')
    expect(row).not.toBeNull()
    expect(row).toHaveClass('verse-row')
  })

  it('selected と highlighted が同時なら両方の属性を付ける', async () => {
    render(
      <VerseRow
        {...baseProps}
        mode="select"
        selected={true}
        onSelect={vi.fn()}
        onOpen={() => {}}
        highlighted
      />,
    )
    // 両方立っているときは選択が勝つ。順序は styles.css の verse-row で決まる
    const checkbox = await screen.findByRole('checkbox')
    expect(checkbox).toHaveAttribute('data-selected')
    expect(checkbox).toHaveAttribute('data-highlighted')
  })

  it('highlighted 未指定なら背景を敷かない', async () => {
    const { container } = render(
      <VerseRow {...baseProps} mode="read" selected={false} onSelect={vi.fn()} onOpen={() => {}} />,
    )
    await waitFor(() => {
      expect(screen.getByText('19')).toBeInTheDocument()
    })
    expect(container.querySelector('[data-highlighted="true"]')).toBeNull()
  })
})

describe('VerseRow showNumber', () => {
  it("showNumber=false のとき mode='read' で節番号を表示しない", async () => {
    render(
      <VerseRow
        {...baseProps}
        mode="read"
        selected={false}
        onSelect={vi.fn()}
        onOpen={() => {}}
        showNumber={false}
      />,
    )
    await waitFor(() => {
      expect(screen.queryByText('19')).toBeNull()
    })
  })

  it("showNumber=false のとき mode='select' でも節番号を表示しない", async () => {
    render(
      <VerseRow
        {...baseProps}
        mode="select"
        selected={false}
        onSelect={vi.fn()}
        onOpen={() => {}}
        showNumber={false}
      />,
    )
    await waitFor(() => {
      expect(screen.queryByText('19')).toBeNull()
      expect(screen.getByRole('checkbox', { name: '19節を選択' })).toBeInTheDocument()
    })
  })
})

describe('VerseRow bilingual', () => {
  it('textHtmlSecondary 指定時は lang 属性付きで第2言語テキストを表示する', async () => {
    const { container } = render(
      <VerseRow
        {...baseProps}
        mode="read"
        selected={false}
        onSelect={vi.fn()}
        onOpen={() => {}}
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
    render(
      <VerseRow
        {...baseProps}
        mode="read"
        selected={false}
        onSelect={vi.fn()}
        onOpen={() => {}}
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
    const { container } = render(
      <VerseRow
        {...baseProps}
        mode="read"
        selected={false}
        onSelect={vi.fn()}
        onOpen={() => {}}
        textHtmlSecondary="Home to the Lord is one way"
        secondaryLang="en"
      />,
    )

    await waitFor(() => {
      expect(container.querySelector('.verse-item')).toHaveAttribute('data-bilingual')
    })
  })

  it('併記していなければ data-bilingual を付けない', async () => {
    const { container } = render(
      <VerseRow {...baseProps} mode="read" selected={false} onSelect={vi.fn()} onOpen={() => {}} />,
    )

    await waitFor(() => {
      expect(container.querySelector('.verse-item')).not.toHaveAttribute('data-bilingual')
    })
  })

  it('textHtmlSecondary が無ければ第2言語ブロックを描画しない', async () => {
    const { container } = render(
      <VerseRow {...baseProps} mode="read" selected={false} onSelect={vi.fn()} onOpen={() => {}} />,
    )
    await waitFor(() => {
      expect(screen.getByText('19')).toBeInTheDocument()
    })
    expect(container.querySelector('[lang]')).toBeNull()
  })

  it('textHtmlSecondary が無ければ本文をdivで包まず、節番号と同じ行に並ぶ', async () => {
    render(
      <VerseRow {...baseProps} mode="read" selected={false} onSelect={vi.fn()} onOpen={() => {}} />,
    )
    await waitFor(() => {
      expect(screen.getByText('19')).toBeInTheDocument()
    })
    const numberSpan = screen.getByText('19')
    expect(numberSpan.nextElementSibling?.tagName).toBe('SPAN')
  })
})
