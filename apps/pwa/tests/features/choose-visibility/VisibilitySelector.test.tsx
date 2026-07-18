import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VisibilitySelector } from '@/features/choose-visibility'

describe('VisibilitySelector', () => {
  it('4つの公開範囲ラジオをレンダーする', () => {
    render(<VisibilitySelector value="public" onChange={() => {}} />)
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /全体公開/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /フォロワー/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /ファミリー/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /自分のみ/ })).toBeInTheDocument()
  })

  it('value に応じたラジオが選択状態になる', () => {
    render(<VisibilitySelector value="family" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: /ファミリー/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /全体公開/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('ラジオクリックで onChange が呼ばれる', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<VisibilitySelector value="public" onChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: /自分のみ/ }))
    expect(onChange).toHaveBeenCalledWith('private')
  })
})
