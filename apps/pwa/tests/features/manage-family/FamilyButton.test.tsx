import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FamilyButton } from '@/features/manage-family'
import type { FamilyStatus } from '@/entities/family'
import { renderWithQueryClient } from '../../helpers/query'

const { mockToastError } = vi.hoisted(() => ({ mockToastError: vi.fn() }))

vi.mock('sonner', () => ({ toast: { error: mockToastError } }))

type Result = { error: unknown }

let insertResult: Promise<Result> = Promise.resolve({ error: null })
let updateResult: Promise<Result> = Promise.resolve({ error: null })
let deleteResult: Promise<Result> = Promise.resolve({ error: null })

const mockInsert = vi.fn(() => insertResult)
const mockUpdate = vi.fn(() => chainOn(() => updateResult))
const mockDelete = vi.fn(() => chainOn(() => deleteResult))

// .eq() / .in() を繋げられて、そのまま await できる形。filterFamilyPair が .in() を
// 2 回呼ぶため、チェーンの戻りは常に自分自身にする
function chainOn(result: () => Promise<Result>) {
  const calls: [string, unknown][] = []
  const chain = {
    calls,
    eq: (column: string, value: unknown) => {
      calls.push([column, value])
      return chain
    },
    in: (column: string, values: unknown) => {
      calls.push([column, values])
      return chain
    },
    then: (onOk: (v: Result) => unknown, onErr?: (e: unknown) => unknown) =>
      result().then(onOk, onErr),
  }
  return chain
}

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    }),
  },
}))

const renderButton = (status: FamilyStatus) => {
  let current = status
  const utils = renderWithQueryClient(() => (
    <FamilyButton targetUserId="u2" currentUserId="u1" status={current} />
  ))
  return {
    ...utils,
    refetchAs: (next: FamilyStatus) => {
      current = next
      utils.rerenderWithQueryClient()
    },
  }
}

describe('FamilyButton', () => {
  beforeEach(() => {
    insertResult = Promise.resolve({ error: null })
    updateResult = Promise.resolve({ error: null })
    deleteResult = Promise.resolve({ error: null })
    mockInsert.mockClear()
    mockUpdate.mockClear()
    mockDelete.mockClear()
    mockToastError.mockClear()
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
    expect(mockUpdate.mock.results[0].value.calls).toEqual([
      ['requester_id', 'u2'],
      ['addressee_id', 'u1'],
    ])
  })

  it('「ファミリー」で両方向の行を削除する', async () => {
    renderButton('accepted')
    await userEvent.click(screen.getByRole('button', { name: 'ファミリー' }))
    await waitFor(() => expect(mockDelete).toHaveBeenCalled())
    expect(mockDelete.mock.results[0].value.calls).toEqual([
      ['requester_id', ['u1', 'u2']],
      ['addressee_id', ['u1', 'u2']],
    ])
  })

  it('送信中は押した結果を先に表示する', async () => {
    let resolve: (value: Result) => void = () => {}
    insertResult = new Promise((r) => {
      resolve = r
    })
    renderButton('none')
    await userEvent.click(screen.getByRole('button', { name: 'ファミリーに追加' }))
    expect(await screen.findByRole('button', { name: '招待送信済み' })).toBeInTheDocument()
    resolve({ error: null })
  })

  it('成功したらプロフィールとフォロー一覧のクエリを無効化する', async () => {
    const { client } = renderButton('none')
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await userEvent.click(screen.getByRole('button', { name: 'ファミリーに追加' }))
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['profile'] }))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['connections'] })
  })

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
    updateResult = Promise.resolve({ error: { message: 'rls' } })
    renderButton('pending_received')
    await userEvent.click(screen.getByRole('button', { name: '招待を承認' }))
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith('招待を承認できませんでした'),
    )
  })

  it('解除に失敗したら操作に応じたトーストを出す', async () => {
    deleteResult = Promise.resolve({ error: { message: 'rls' } })
    renderButton('accepted')
    await userEvent.click(screen.getByRole('button', { name: 'ファミリー' }))
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith('ファミリーから外せませんでした'),
    )
  })
})
