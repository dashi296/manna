import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FamilyButton } from '@/features/manage-family'
import type { FamilyStatus } from '@/entities/family'
import { renderWithQueryClient } from '../../helpers/query'
import { createSupabaseQueryChain } from '../../helpers/supabase'
import { deferred } from '../../helpers/deferred'

const { mockToastError } = vi.hoisted(() => ({ mockToastError: vi.fn() }))

vi.mock('@/shared/ui/sonner', () => ({ toast: { error: mockToastError } }))

let insertResult: Promise<{ error: unknown }> = Promise.resolve({ error: null })
let updateError: unknown = null
let deleteError: unknown = null

const mockInsert = vi.fn(() => insertResult)
const mockUpdateEq = vi.fn()
const mockDeleteIn = vi.fn()
const mockUpdate = vi.fn(() => createSupabaseQueryChain(() => ({ error: updateError }), mockUpdateEq))
const mockDelete = vi.fn(() => createSupabaseQueryChain(() => ({ error: deleteError }), mockDeleteIn))

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    }),
  },
}))

const renderButton = (status: FamilyStatus) =>
  renderWithQueryClient(() => (
    <FamilyButton targetUserId="u2" currentUserId="u1" status={status} />
  ))

describe('FamilyButton', () => {
  beforeEach(() => {
    insertResult = Promise.resolve({ error: null })
    updateError = null
    deleteError = null
  })

  it('関係が無いときは「ファミリーに追加」を表示する', () => {
    renderButton('none')
    expect(screen.getByRole('button', { name: 'ファミリーに追加' })).toBeInTheDocument()
  })

  it('招待済みのときは押せないボタンを表示する', () => {
    renderButton('pending_sent')
    expect(screen.getByRole('button', { name: '招待送信済み' })).toBeDisabled()
  })

  it('招待されているときは「招待を承認」を表示する', () => {
    renderButton('pending_received')
    expect(screen.getByRole('button', { name: '招待を承認' })).toBeInTheDocument()
  })

  it('成立しているときは「ファミリー」を表示する', () => {
    renderButton('accepted')
    expect(screen.getByRole('button', { name: 'ファミリー' })).toBeInTheDocument()
  })

  it('「ファミリーに追加」で自分を requester として招待を作る', async () => {
    renderButton('none')
    await userEvent.click(screen.getByRole('button', { name: 'ファミリーに追加' }))
    await waitFor(() =>
      expect(mockInsert).toHaveBeenCalledWith({ requester_id: 'u1', addressee_id: 'u2' }),
    )
  })

  it('「招待を承認」で相手からの行を accepted に更新する', async () => {
    renderButton('pending_received')
    await userEvent.click(screen.getByRole('button', { name: '招待を承認' }))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ status: 'accepted' }))
    expect(mockUpdateEq).toHaveBeenCalledWith('requester_id', 'u2')
    expect(mockUpdateEq).toHaveBeenCalledWith('addressee_id', 'u1')
  })

  it('「ファミリー」で両方向の行を削除する', async () => {
    renderButton('accepted')
    await userEvent.click(screen.getByRole('button', { name: 'ファミリー' }))
    await waitFor(() => expect(mockDelete).toHaveBeenCalled())
    expect(mockDeleteIn).toHaveBeenCalledWith('requester_id', ['u1', 'u2'])
    expect(mockDeleteIn).toHaveBeenCalledWith('addressee_id', ['u1', 'u2'])
  })

  it('送信中は押した結果を先に表示する', async () => {
    const pending = deferred<{ error: unknown }>()
    insertResult = pending.promise
    renderButton('none')
    await userEvent.click(screen.getByRole('button', { name: 'ファミリーに追加' }))
    expect(await screen.findByRole('button', { name: '招待送信済み' })).toBeInTheDocument()
    pending.resolve({ error: null })
  })

  // 成功後の無効化は FollowButton と同じ useRelationMutation の責務なので、そちらで固定する

  it('招待の作成に失敗したらトーストを出して表示を元に戻す', async () => {
    insertResult = Promise.resolve({ error: { message: 'duplicate key value' } })
    renderButton('none')
    await userEvent.click(screen.getByRole('button', { name: 'ファミリーに追加' }))
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith('ファミリーに追加できませんでした'),
    )
    expect(screen.getByRole('button', { name: 'ファミリーに追加' })).toBeEnabled()
  })

  it('承認に失敗したら操作に応じたトーストを出す', async () => {
    updateError = { message: 'rls' }
    renderButton('pending_received')
    await userEvent.click(screen.getByRole('button', { name: '招待を承認' }))
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('招待を承認できませんでした'))
  })

  it('解除に失敗したら操作に応じたトーストを出す', async () => {
    deleteError = { message: 'rls' }
    renderButton('accepted')
    await userEvent.click(screen.getByRole('button', { name: 'ファミリー' }))
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith('ファミリーから外せませんでした'),
    )
  })
})
