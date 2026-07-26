import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FollowButton } from '@/features/follow-user'
import { renderWithQueryClient } from '../../helpers/query'
import { createSupabaseQueryChain } from '../../helpers/supabase'
import { deferred } from '../../helpers/deferred'

const { mockToastError } = vi.hoisted(() => ({ mockToastError: vi.fn() }))

vi.mock('sonner', () => ({ toast: { error: mockToastError } }))

let insertResult: Promise<{ error: unknown }> = Promise.resolve({ error: null })

const mockInsert = vi.fn(() => insertResult)
const mockDeleteEq = vi.fn()
const mockDelete = vi.fn(() => createSupabaseQueryChain(() => ({ error: null }), mockDeleteEq))

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: mockInsert,
      delete: mockDelete,
    }),
  },
}))

const renderButton = (isFollowing: boolean) => {
  let following = isFollowing
  const utils = renderWithQueryClient(() => (
    <FollowButton targetUserId="u2" currentUserId="u1" isFollowing={following} />
  ))
  // 無効化後の再取得で prop が入れ替わるところを再現する
  return {
    ...utils,
    refetchAs: (next: boolean) => {
      following = next
      utils.rerenderWithQueryClient()
    },
  }
}

describe('FollowButton', () => {
  beforeEach(() => {
    insertResult = Promise.resolve({ error: null })
    vi.clearAllMocks()
  })

  it('未フォロー時に「フォロー」ボタンを表示する', () => {
    renderButton(false)
    expect(screen.getByRole('button', { name: 'フォロー' })).toBeInTheDocument()
  })

  it('フォロー済み時に「フォロー中」ボタンを表示する', () => {
    renderButton(true)
    expect(screen.getByRole('button', { name: 'フォロー中' })).toBeInTheDocument()
  })

  it('未フォロー時のクリックで follows に自分と相手の組を追加する', async () => {
    renderButton(false)
    await userEvent.click(screen.getByRole('button', { name: 'フォロー' }))
    await waitFor(() =>
      expect(mockInsert).toHaveBeenCalledWith({ follower_id: 'u1', following_id: 'u2' }),
    )
  })

  it('フォロー済み時のクリックで該当行だけを削除する', async () => {
    renderButton(true)
    await userEvent.click(screen.getByRole('button', { name: 'フォロー中' }))
    await waitFor(() => expect(mockDelete).toHaveBeenCalled())
    expect(mockDeleteEq).toHaveBeenCalledWith('follower_id', 'u1')
    expect(mockDeleteEq).toHaveBeenCalledWith('following_id', 'u2')
  })

  it('送信中は押した結果を先に表示し、ボタンを無効化する', async () => {
    const pending = deferred<{ error: unknown }>()
    insertResult = pending.promise
    renderButton(false)
    await userEvent.click(screen.getByRole('button', { name: 'フォロー' }))

    const button = await screen.findByRole('button', { name: 'フォロー中' })
    expect(button).toBeDisabled()

    pending.resolve({ error: null })
  })

  it('成功したらプロフィールとフォロー一覧のクエリを無効化する', async () => {
    const { client } = renderButton(false)
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await userEvent.click(screen.getByRole('button', { name: 'フォロー' }))
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['profile'] }))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['connections'] })
  })

  it('再取得で prop が入れ替わっても表示が巻き戻らない', async () => {
    const { refetchAs } = renderButton(false)
    await userEvent.click(screen.getByRole('button', { name: 'フォロー' }))
    refetchAs(true)
    expect(await screen.findByRole('button', { name: 'フォロー中' })).toBeInTheDocument()
  })

  it('失敗したらトーストを出して表示を元に戻す', async () => {
    insertResult = Promise.resolve({ error: { message: 'new row violates row-level security' } })
    renderButton(false)
    await userEvent.click(screen.getByRole('button', { name: 'フォロー' }))

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith('フォローを更新できませんでした'),
    )
    expect(screen.getByRole('button', { name: 'フォロー' })).toBeEnabled()
  })
})
