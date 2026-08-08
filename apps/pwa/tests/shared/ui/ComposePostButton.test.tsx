import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComposePostButton } from '@/shared/ui'

describe('ComposePostButton', () => {
  it('pill ではラベルをテキストとして表示する', () => {
    render(<ComposePostButton label="投稿する" />)
    expect(screen.getByRole('button', { name: '投稿する' })).toHaveTextContent('投稿する')
  })

  it('fab ではラベルを aria-label として持ち、テキストは表示しない', () => {
    render(<ComposePostButton layout="fab" label="投稿する" />)
    const button = screen.getByRole('button', { name: '投稿する' })
    expect(button.textContent).toBe('')
    expect(button).toHaveAttribute('aria-label', '投稿する')
  })

  it('fab は画面右下に固定配置される', () => {
    render(<ComposePostButton layout="fab" label="投稿する" />)
    expect(screen.getByRole('button', { name: '投稿する' }).className).toContain('fixed')
  })

  it('fab は BottomNav と InstallPwaBanner の両方を避けた高さに配置される', () => {
    render(<ComposePostButton layout="fab" label="投稿する" />)
    expect(screen.getByRole('button', { name: '投稿する' }).className).toContain(
      'bottom-[calc(var(--bottom-nav-h)+var(--install-banner-h)+1rem)]',
    )
  })

  it('onClick と aria 属性を下位のボタンへ渡す', async () => {
    const onClick = vi.fn()
    render(
      <ComposePostButton
        layout="fab"
        label="投稿する"
        onClick={onClick}
        aria-haspopup="menu"
        aria-expanded={false}
      />,
    )
    const button = screen.getByRole('button', { name: '投稿する' })
    expect(button).toHaveAttribute('aria-haspopup', 'menu')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
