import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComposeMenu } from '@/widgets/compose-menu'

// setup.ts の matchMedia スタブは change を発火しないため、リスナーを捕まえて
// ブレークポイントの跨ぎを手動で起こせるスタブに差し替える
function stubMatchMedia() {
  const listeners = new Set<() => void>()
  const queries: string[] = []
  const original = window.matchMedia
  window.matchMedia = ((query: string) => {
    queries.push(query)
    return {
      matches: false,
      media: query,
      addEventListener: (_: string, l: () => void) => listeners.add(l),
      removeEventListener: (_: string, l: () => void) => listeners.delete(l),
    } as unknown as MediaQueryList
  }) as typeof window.matchMedia
  return {
    queries,
    crossBreakpoint: () => act(() => listeners.forEach((l) => l())),
    restore: () => {
      window.matchMedia = original
    },
  }
}

// 表示の出し分けは CSS のブレークポイントが行うため、ComposeMenu 自体は
// ビューポートを見ない。innerWidth を変えても layout だけで結果が決まる。
function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, value: width })
}

describe('ComposeMenu', () => {
  beforeEach(() => {
    setViewportWidth(1024)
  })

  it('layout 未指定ならピルのトリガーを描画する', () => {
    render(<ComposeMenu onSelectChapter={vi.fn()} onSelectVerses={vi.fn()} />)
    expect(screen.getByRole('button', { name: /投稿/ }).className).not.toContain('fixed')
  })

  it('layout="fab" なら FAB のトリガーを描画する', () => {
    render(<ComposeMenu onSelectChapter={vi.fn()} onSelectVerses={vi.fn()} layout="fab" />)
    expect(screen.getByRole('button', { name: '投稿する' }).className).toContain('fixed')
  })

  it('モバイル幅でも layout 未指定ならピルとポップオーバーのままで、FAB とボトムシートに変わらない', async () => {
    setViewportWidth(390)
    render(<ComposeMenu onSelectChapter={vi.fn()} onSelectVerses={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /投稿/ })
    expect(trigger.className).not.toContain('fixed')

    await userEvent.click(trigger)
    await screen.findByRole('menuitem', { name: /章全体に投稿/ })
    // ボトムシートだけが「投稿する」の見出しを持つ
    expect(screen.queryByRole('heading', { name: '投稿する' })).toBeNull()
  })

  it('デスクトップ幅でも layout="fab" なら FAB とボトムシートのままで、ピルに変わらない', async () => {
    setViewportWidth(1440)
    render(<ComposeMenu onSelectChapter={vi.fn()} onSelectVerses={vi.fn()} layout="fab" />)
    const trigger = screen.getByRole('button', { name: '投稿する' })
    expect(trigger.className).toContain('fixed')

    await userEvent.click(trigger)
    expect(await screen.findByRole('heading', { name: '投稿する' })).toBeInTheDocument()
  })

  it('className をトリガーに転送する（呼び出し側がブレークポイントを指定できる）', () => {
    render(
      <ComposeMenu
        onSelectChapter={vi.fn()}
        onSelectVerses={vi.fn()}
        className="hidden lg:inline-flex"
      />,
    )
    const trigger = screen.getByRole('button', { name: /投稿/ })
    expect(trigger.className).toContain('hidden')
    expect(trigger.className).toContain('lg:inline-flex')
  })

  // Popover を流用すると Popup が role="dialog" を持ち、内側の role="menu" を
  // 包んでしまう。fab レイアウトは Sheet（dialog）なので対象外、pill だけの話
  it('ピルのメニューが role="dialog" に包まれない', async () => {
    render(<ComposeMenu onSelectChapter={vi.fn()} onSelectVerses={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /投稿/ }))
    const menu = await screen.findByRole('menu')

    expect(menu.closest('[role="dialog"]')).toBeNull()
  })

  it('ピルのトリガーから「章全体に投稿」で onSelectChapter が呼ばれる', async () => {
    const onSelectChapter = vi.fn()
    render(<ComposeMenu onSelectChapter={onSelectChapter} onSelectVerses={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /投稿/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /章全体に投稿/ }))
    expect(onSelectChapter).toHaveBeenCalledOnce()
  })

  it('ピルのトリガーから「節を選んで投稿」で onSelectVerses が呼ばれる', async () => {
    const onSelectVerses = vi.fn()
    render(<ComposeMenu onSelectChapter={vi.fn()} onSelectVerses={onSelectVerses} />)
    await userEvent.click(screen.getByRole('button', { name: /投稿/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /節を選んで投稿/ }))
    expect(onSelectVerses).toHaveBeenCalledOnce()
  })

  // Sheet / Popover の中身は portal に描画されるため、トリガーに付けた
  // ブレークポイントの class では隠せない。開いたまま境界をまたぐと
  // 非表示側のメニューだけが画面に取り残される。
  describe('ブレークポイントを跨いだとき', () => {
    let media: ReturnType<typeof stubMatchMedia>

    beforeEach(() => {
      media = stubMatchMedia()
    })
    afterEach(() => {
      media.restore()
    })

    // Tailwind の lg は 64rem。px 固定で監視するとブラウザの既定フォント
    // サイズを変えている環境で CSS 側の境界とずれ、閉じるべき場面で発火しない。
    it('CSS の lg と同じ rem 単位で監視する', () => {
      render(<ComposeMenu onSelectChapter={vi.fn()} onSelectVerses={vi.fn()} />)
      expect(media.queries).toContain('(min-width: 64rem)')
    })

    it('開いていたボトムシートを閉じる', async () => {
      render(<ComposeMenu onSelectChapter={vi.fn()} onSelectVerses={vi.fn()} layout="fab" />)
      await userEvent.click(screen.getByRole('button', { name: '投稿する' }))
      expect(await screen.findByRole('button', { name: /章全体に投稿/ })).toBeInTheDocument()

      media.crossBreakpoint()

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /章全体に投稿/ })).toBeNull()
      })
    })

    it('開いていたポップオーバーを閉じる', async () => {
      render(<ComposeMenu onSelectChapter={vi.fn()} onSelectVerses={vi.fn()} />)
      await userEvent.click(screen.getByRole('button', { name: /投稿/ }))
      expect(await screen.findByRole('menuitem', { name: /章全体に投稿/ })).toBeInTheDocument()

      media.crossBreakpoint()

      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: /章全体に投稿/ })).toBeNull()
      })
    })
  })

  it('FAB を押すとボトムシートで同じ2択が開く', async () => {
    render(<ComposeMenu onSelectChapter={vi.fn()} onSelectVerses={vi.fn()} layout="fab" />)
    await userEvent.click(screen.getByRole('button', { name: '投稿する' }))
    expect(await screen.findByRole('button', { name: /章全体に投稿/ })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /節を選んで投稿/ })).toBeInTheDocument()
  })
})
