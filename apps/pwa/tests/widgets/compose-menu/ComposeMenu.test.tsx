import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComposeMenu } from '@/widgets/compose-menu'

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

  it('FAB を押すとボトムシートで同じ2択が開く', async () => {
    render(<ComposeMenu onSelectChapter={vi.fn()} onSelectVerses={vi.fn()} layout="fab" />)
    await userEvent.click(screen.getByRole('button', { name: '投稿する' }))
    expect(await screen.findByRole('menuitem', { name: /章全体に投稿/ })).toBeInTheDocument()
    expect(await screen.findByRole('menuitem', { name: /節を選んで投稿/ })).toBeInTheDocument()
  })
})
