import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ViewModeToggle } from '@/features/select-verse-view/ui/ViewModeToggle'

describe('ViewModeToggle', () => {
  it('radiogroup と 2 radio を描画', () => {
    render(<ViewModeToggle value="count" onChange={vi.fn()} />)
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '件数' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('radio', { name: '誰が' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })
  it('クリックで onChange を反対の値で呼ぶ', async () => {
    const onChange = vi.fn()
    render(<ViewModeToggle value="count" onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: '誰が' }))
    expect(onChange).toHaveBeenCalledWith('who')
  })
  it('現在値と同じボタンでは onChange を呼ばない', async () => {
    const onChange = vi.fn()
    render(<ViewModeToggle value="who" onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: '誰が' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
