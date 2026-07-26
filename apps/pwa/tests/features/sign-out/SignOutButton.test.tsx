import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignOutButton } from '@/features/sign-out'

const mockSignOut = vi.fn()
const mockNavigate = vi.fn()

vi.mock('@/shared/lib/auth', () => ({
  signOut: () => mockSignOut(),
}))

vi.mock('@tanstack/react-router', async () =>
  (await import('../../helpers/tanstack')).routerMock(undefined, undefined, (opts) =>
    mockNavigate(opts),
  ),
)

const openSheet = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'ログアウト' }))
  return screen.getByRole('dialog')
}

describe('SignOutButton', () => {
  beforeEach(() => {
    mockSignOut.mockReset().mockResolvedValue(undefined)
    mockNavigate.mockReset()
  })

  it('押すと確認シートを開く', async () => {
    render(<SignOutButton />)
    expect(screen.queryByRole('dialog')).toBeNull()

    const dialog = await openSheet()

    expect(within(dialog).getByText('ログアウトしますか？')).toBeInTheDocument()
  })

  it('キャンセルではログアウトしない', async () => {
    render(<SignOutButton />)
    const dialog = await openSheet()

    await userEvent.click(within(dialog).getByRole('button', { name: 'キャンセル' }))

    expect(mockSignOut).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('確認するとログアウトしてログイン画面へ送る', async () => {
    render(<SignOutButton />)
    const dialog = await openSheet()

    await userEvent.click(within(dialog).getByRole('button', { name: 'ログアウトする' }))

    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/login',
      replace: true,
      reloadDocument: true,
    })
  })

  it('失敗したら遷移せず、もう一度押せる状態に戻す', async () => {
    mockSignOut.mockRejectedValue(new Error('boom'))
    render(<SignOutButton />)
    const dialog = await openSheet()
    const confirm = within(dialog).getByRole('button', { name: 'ログアウトする' })

    await userEvent.click(confirm)

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(confirm).not.toBeDisabled()
  })
})
