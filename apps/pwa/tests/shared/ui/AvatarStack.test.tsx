import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AvatarStack, type AvatarStackItem } from '@/shared/ui/AvatarStack'

const items: AvatarStackItem[] = [
  { userId: 'u1', name: '中村さん', avatarUrl: null },
  { userId: 'u2', name: '田中さん', avatarUrl: 'https://example.com/a.png' },
  { userId: 'u3', name: '佐藤さん', avatarUrl: null },
  { userId: 'u4', name: '鈴木さん', avatarUrl: null },
  { userId: 'u5', name: '山田さん', avatarUrl: null },
]

describe('AvatarStack', () => {
  it('空配列は何もレンダリングしない', () => {
    const { container } = render(<AvatarStack items={[]} />)
    expect(container.firstChild).toBeNull()
  })
  it('items <= max は全員描画、+N は出さない', () => {
    render(<AvatarStack items={items.slice(0, 3)} max={3} />)
    expect(screen.getByRole('img', { name: '田中さん' })).toBeInTheDocument()
    expect(screen.queryByText(/^\+/)).toBeNull()
  })
  it('items > max は max 個 + +N', () => {
    render(<AvatarStack items={items} max={3} />)
    expect(screen.getByText('+2')).toBeInTheDocument()
  })
  it('ariaLabel を role=group の aria-label に反映', () => {
    render(<AvatarStack items={items.slice(0, 2)} ariaLabel="2件" />)
    expect(screen.getByRole('group', { name: '2件' })).toBeInTheDocument()
  })
})
