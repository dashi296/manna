import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BilingualToggleButton } from '@/features/toggle-bilingual'
import { useBilingualDisplayStore } from '@/entities/bilingual-display'

describe('BilingualToggleButton', () => {
  beforeEach(() => {
    localStorage.clear()
    useBilingualDisplayStore.setState({ enabled: false })
  })

  it('enabled=false のとき「オンにする」ラベルで aria-pressed=false', () => {
    render(<BilingualToggleButton />)
    const btn = screen.getByRole('button', { name: '日英併記表示をオンにする' })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('クリックするとストアの enabled が反転し「オフにする」ラベルに切り替わる', async () => {
    const user = userEvent.setup()
    render(<BilingualToggleButton />)
    await user.click(screen.getByRole('button', { name: '日英併記表示をオンにする' }))
    expect(await screen.findByRole('button', { name: '日英併記表示をオフにする' })).toBeInTheDocument()
    expect(useBilingualDisplayStore.getState().enabled).toBe(true)
  })

  it('enabled=true 状態でクリックすると解除される', async () => {
    useBilingualDisplayStore.setState({ enabled: true })
    const user = userEvent.setup()
    render(<BilingualToggleButton />)
    await user.click(screen.getByRole('button', { name: '日英併記表示をオフにする' }))
    expect(await screen.findByRole('button', { name: '日英併記表示をオンにする' })).toBeInTheDocument()
    expect(useBilingualDisplayStore.getState().enabled).toBe(false)
  })
})
