import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BilingualToggleButton } from '@/features/toggle-bilingual'

describe('BilingualToggleButton', () => {
  it('active=false のとき「オンにする」ラベルで aria-pressed=false', () => {
    render(<BilingualToggleButton active={false} onToggle={vi.fn()} />)
    const btn = screen.getByRole('button', { name: '日英併記表示をオンにする' })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('active=true のとき「オフにする」ラベルで aria-pressed=true', () => {
    render(<BilingualToggleButton active={true} onToggle={vi.fn()} />)
    const btn = screen.getByRole('button', { name: '日英併記表示をオフにする' })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('クリックで onToggle が呼ばれる', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<BilingualToggleButton active={false} onToggle={onToggle} />)
    await user.click(screen.getByRole('button', { name: '日英併記表示をオンにする' }))
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
