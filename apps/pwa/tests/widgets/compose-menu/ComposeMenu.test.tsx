import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComposeMenu } from '@/widgets/compose-menu'
import { useIsMobile } from '@/shared/hooks/use-mobile'

vi.mock('@/shared/hooks/use-mobile', () => ({
  useIsMobile: vi.fn(),
}))

describe('ComposeMenu (desktop)', () => {
  beforeEach(() => {
    vi.mocked(useIsMobile).mockReturnValue(false)
  })

  it('「章全体に投稿」で onSelectChapter が呼ばれる', async () => {
    const onSelectChapter = vi.fn()
    render(
      <ComposeMenu onSelectChapter={onSelectChapter} onSelectVerses={vi.fn()} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /投稿/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /章全体に投稿/ }))
    expect(onSelectChapter).toHaveBeenCalledOnce()
  })

  it('「節を選んで投稿」で onSelectVerses が呼ばれる', async () => {
    const onSelectVerses = vi.fn()
    render(
      <ComposeMenu onSelectChapter={vi.fn()} onSelectVerses={onSelectVerses} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /投稿/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /節を選んで投稿/ }))
    expect(onSelectVerses).toHaveBeenCalledOnce()
  })
})

describe('ComposeMenu (mobile)', () => {
  beforeEach(() => {
    vi.mocked(useIsMobile).mockReturnValue(true)
  })

  it('モバイルでもメニュー項目が表示される', async () => {
    render(<ComposeMenu onSelectChapter={vi.fn()} onSelectVerses={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /投稿/ }))
    expect(await screen.findByRole('menuitem', { name: /章全体に投稿/ })).toBeInTheDocument()
    expect(await screen.findByRole('menuitem', { name: /節を選んで投稿/ })).toBeInTheDocument()
  })
})
