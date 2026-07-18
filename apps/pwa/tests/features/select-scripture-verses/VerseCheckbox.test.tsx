import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VerseCheckbox } from '@/features/select-scripture-verses'

describe('VerseCheckbox', () => {
  it('aria-checked を反映', () => {
    render(<VerseCheckbox verse={3} checked={false} onToggle={() => {}} />)
    expect(screen.getByRole('checkbox', { name: '3節を選択' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('クリックで onToggle が節番号付きで呼ばれる', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<VerseCheckbox verse={5} checked={false} onToggle={onToggle} />)
    await user.click(screen.getByRole('checkbox'))
    expect(onToggle).toHaveBeenCalledWith(5)
  })
})
