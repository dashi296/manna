import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WhoFilterSheet } from '@/features/select-verse-view/ui/WhoFilterSheet'

const users = [
  { userId: 'u1', name: '中村さん', avatarUrl: null },
  { userId: 'u2', name: '田中さん', avatarUrl: null },
]

function renderSheet(overrides: Partial<Parameters<typeof WhoFilterSheet>[0]> = {}) {
  const onToggle = vi.fn()
  const onSetAll = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <WhoFilterSheet
      open={true}
      users={users}
      isIncluded={() => true}
      onToggle={onToggle}
      onSetAll={onSetAll}
      onOpenChange={onOpenChange}
      {...overrides}
    />,
  )
  return { onToggle, onSetAll, onOpenChange }
}

describe('WhoFilterSheet', () => {
  it('users のチェックボックスをすべて描画する', () => {
    renderSheet()
    expect(screen.getByRole('checkbox', { name: /中村さん/ })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /田中さん/ })).toBeInTheDocument()
  })

  it('isIncluded=false のユーザーは aria-checked="false"', () => {
    renderSheet({ isIncluded: (id) => id !== 'u2' })
    expect(screen.getByRole('checkbox', { name: /田中さん/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('チェックボックスをクリックすると onToggle を該当 ID で呼ぶ', async () => {
    const { onToggle } = renderSheet()
    await userEvent.click(screen.getByRole('checkbox', { name: /田中さん/ }))
    expect(onToggle).toHaveBeenCalledWith('u2')
  })

  it('「すべて解除」で onSetAll(全ID, false)', async () => {
    const { onSetAll } = renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'すべて解除' }))
    expect(onSetAll).toHaveBeenCalledWith(['u1', 'u2'], false)
  })

  it('「すべて選択」で onSetAll(全ID, true)', async () => {
    const { onSetAll } = renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'すべて選択' }))
    expect(onSetAll).toHaveBeenCalledWith(['u1', 'u2'], true)
  })

  it('users が空なら空状態文言を描画する', () => {
    renderSheet({ users: [] })
    expect(screen.getByText('フォロー中／家族の投稿がここに表示されます')).toBeInTheDocument()
  })
})
