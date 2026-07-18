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

  it('デスクトップ幅ではアイコン中心の小さなフローティング操作として表示する', () => {
    render(<SelectionBar selection={[1, 2, 3, 4, 5, 6]} onClear={() => {}} onOpenComposer={() => {}} />)
    expect(screen.getByTestId('selection-bar')).toHaveClass(
      'lg:left-auto',
      'lg:right-6',
      'lg:bottom-6',
      'lg:w-44',
      'lg:rounded-full',
      'lg:gap-2',
      'lg:border',
      'lg:p-2',
      'lg:shadow-md',
    )
    expect(screen.getByTestId('selection-count-pill')).toHaveClass('lg:flex', 'lg:w-10', 'lg:rounded-full')
    expect(screen.getByTestId('selection-label')).toHaveClass('lg:sr-only')
    expect(screen.getByRole('button', { name: '選択をクリア' })).toHaveClass('shrink-0', 'lg:size-7', 'lg:px-0')
    expect(screen.getByRole('button', { name: '選択した節を投稿' })).toHaveClass(
      'shrink-0',
      'lg:h-7',
      'lg:flex-1',
      'lg:text-xs',
    )
  })

  it('クリアボタンで onClear が呼ばれる', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(<SelectionBar selection={[1]} onClear={onClear} onOpenComposer={() => {}} />)
    await user.click(screen.getByRole('button', { name: '選択をクリア' }))
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('投稿ボタンで onOpenComposer が呼ばれる', async () => {
    const user = userEvent.setup()
    const onOpenComposer = vi.fn()
    render(<SelectionBar selection={[1]} onClear={() => {}} onOpenComposer={onOpenComposer} />)
    await user.click(screen.getByRole('button', { name: '選択した節を投稿' }))
    expect(onOpenComposer).toHaveBeenCalledOnce()
  })
})
