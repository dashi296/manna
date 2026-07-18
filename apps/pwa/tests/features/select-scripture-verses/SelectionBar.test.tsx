import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SelectionBar } from '@/features/select-scripture-verses'

describe('SelectionBar', () => {
  it('選択0件で非表示', () => {
    const { container } = render(
      <SelectionBar selection={[]} onClear={() => {}} onOpenComposer={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('選択1件以上でラベル表示', () => {
    render(<SelectionBar selection={[1, 2]} onClear={() => {}} onOpenComposer={() => {}} />)
    expect(screen.getByText(/2節選択中:/)).toBeInTheDocument()
    expect(screen.getByText(/1, 2/)).toBeInTheDocument()
  })

  it('クリアボタンで onClear が呼ばれる', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(<SelectionBar selection={[1]} onClear={onClear} onOpenComposer={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'クリア' }))
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('投稿ボタンで onOpenComposer が呼ばれる', async () => {
    const user = userEvent.setup()
    const onOpenComposer = vi.fn()
    render(<SelectionBar selection={[1]} onClear={() => {}} onOpenComposer={onOpenComposer} />)
    await user.click(screen.getByRole('button', { name: '投稿' }))
    expect(onOpenComposer).toHaveBeenCalledOnce()
  })
})
