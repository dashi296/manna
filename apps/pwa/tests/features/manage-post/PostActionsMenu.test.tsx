import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PostActionsMenu } from '@/features/manage-post'
import { renderWithQueryClient } from '../../helpers/query'

const mockDelete = vi.fn()
const mockDeleteEq = vi.fn()
const mockDeleteResult = vi.fn()
const mockInvalidatePostLists = vi.fn()
const mockBack = vi.fn()
const mockCanGoBack = vi.fn()
const mockNavigate = vi.fn()
const mockToastError = vi.fn()
const mockToast = vi.fn()

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: () => ({
      delete: () => {
        mockDelete()
        return {
          eq: (column: string, value: unknown) => {
            mockDeleteEq(column, value)
            return { select: () => mockDeleteResult() }
          },
        }
      },
    }),
  },
}))

// 削除フローが一覧キャッシュを確実に落とすことを見るためのスパイ
vi.mock('@/entities/user', () => ({
  invalidatePostLists: () => {
    mockInvalidatePostLists()
    return Promise.resolve([])
  },
}))

vi.mock('@/shared/ui/sonner', () => ({
  toast: Object.assign((msg: string) => mockToast(msg), { error: (msg: string) => mockToastError(msg) }),
}))

vi.mock('@tanstack/react-router', async () =>
  (await import('../../helpers/tanstack')).routerMock(
    undefined,
    undefined,
    (opts) => mockNavigate(opts),
    undefined,
    {
      canGoBack: () => mockCanGoBack(),
      back: () => mockBack(),
    },
  ),
)

const renderMenu = (onEdit = vi.fn()) => {
  renderWithQueryClient(() => <PostActionsMenu postId="p1" onEdit={onEdit} />)
  return onEdit
}

const openMenu = async () => {
  await userEvent.click(screen.getByRole('button', { name: '投稿の操作' }))
  return await screen.findByRole('menu')
}

// Base UI の Popover Popup も role="dialog" を持つため、findByRole('dialog') は
// メニューの残骸と衝突しうる。確認シートは data-slot で一意に取る
const openConfirmSheet = async () => {
  const menu = await openMenu()
  await userEvent.click(within(menu).getByRole('menuitem', { name: '削除' }))
  const title = await screen.findByText('投稿を削除しますか？')
  return title.closest('[data-slot="sheet-content"]') as HTMLElement
}

describe('PostActionsMenu', () => {
  beforeEach(() => {
    mockDelete.mockClear()
    mockDeleteEq.mockClear()
    mockDeleteResult.mockClear().mockResolvedValue({ data: [{ id: 'p1' }], error: null })
    mockInvalidatePostLists.mockClear()
    mockBack.mockClear()
    mockCanGoBack.mockClear().mockReturnValue(true)
    mockNavigate.mockClear()
    mockToast.mockClear()
    mockToastError.mockClear()
  })

  it('開くまでメニュー項目は出ない', () => {
    renderMenu()

    expect(screen.queryByRole('menuitem', { name: '編集' })).toBeNull()
  })

  // Popover を流用すると Popup が role="dialog" を持ち、内側の role="menu" を
  // 包んでしまう。スクリーンリーダーが「メニュー」ではなく「ダイアログ」と
  // 読み上げるため、menu 専用プリミティブでは dialog に包まれてはいけない
  it('メニューが role="dialog" に包まれない', async () => {
    renderMenu()
    const menu = await openMenu()

    expect(menu.closest('[role="dialog"]')).toBeNull()
  })

  it('矢印キーで項目間をロービングタブインデックスで移動できる', async () => {
    renderMenu()
    // マウスクリックで開いた場合はハイライトのみでフォーカス移動しないため、
    // キーボードでの実利用経路（トリガーにフォーカス→Enter で開く）で検証する
    screen.getByRole('button', { name: '投稿の操作' }).focus()
    await userEvent.keyboard('{Enter}')
    const [editItem, deleteItem] = await screen.findAllByRole('menuitem')

    await waitFor(() => expect(editItem).toHaveFocus())

    await userEvent.keyboard('{ArrowDown}')
    expect(deleteItem).toHaveFocus()

    await userEvent.keyboard('{ArrowUp}')
    expect(editItem).toHaveFocus()
  })

  // MenuItem は button ではなく div を描画するため、Enter/Space の発火は
  // ブラウザ標準ではなく Base UI 側のキーハンドラに依存する
  it('フォーカスした項目を Enter で実行する', async () => {
    const onEdit = renderMenu()
    screen.getByRole('button', { name: '投稿の操作' }).focus()
    await userEvent.keyboard('{Enter}')
    await screen.findAllByRole('menuitem')

    await userEvent.keyboard('{Enter}')

    expect(onEdit).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('Escape でメニューを閉じてトリガーへフォーカスを戻す', async () => {
    renderMenu()
    const trigger = screen.getByRole('button', { name: '投稿の操作' })
    await userEvent.click(trigger)
    await screen.findByRole('menu')

    await userEvent.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(trigger).toHaveFocus()
  })

  it('「編集」で onEdit を呼ぶ（削除はしない）', async () => {
    const onEdit = renderMenu()
    const menu = await openMenu()

    await userEvent.click(within(menu).getByRole('menuitem', { name: '編集' }))

    expect(onEdit).toHaveBeenCalledOnce()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('「削除」ではまだ削除せず確認シートを出す', async () => {
    renderMenu()

    const sheet = await openConfirmSheet()

    expect(within(sheet).getByText('削除した投稿は元に戻せません')).toBeInTheDocument()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('キャンセルでは削除しない', async () => {
    renderMenu()
    const sheet = await openConfirmSheet()

    await userEvent.click(within(sheet).getByRole('button', { name: 'キャンセル' }))

    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('確認すると id 指定で削除し、一覧を落として直前の画面へ戻る', async () => {
    renderMenu()
    const sheet = await openConfirmSheet()

    await userEvent.click(within(sheet).getByRole('button', { name: '削除する' }))

    await waitFor(() => expect(mockBack).toHaveBeenCalledOnce())
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 'p1')
    expect(mockToast).toHaveBeenCalledWith('投稿を削除しました')
    expect(mockInvalidatePostLists).toHaveBeenCalledOnce()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  // disabled={pending} は React の再レンダー後にしか効かない。同じ tick に2発届くと
  // state を見るガードでは両方とも false を読むため、ref で止める必要がある
  it('同じ tick に2回押されても削除は1回しか走らない', async () => {
    renderMenu()
    const sheet = await openConfirmSheet()
    const confirm = within(sheet).getByRole('button', { name: '削除する' })

    // userEvent.click は毎回 act で再レンダーを流してしまうので、生のイベントを続けて撃つ
    confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitFor(() => expect(mockBack).toHaveBeenCalled())
    expect(mockDelete).toHaveBeenCalledTimes(1)
  })

  it('戻れる履歴が無ければフィードへ送る（削除済み詳細を履歴に残さない）', async () => {
    mockCanGoBack.mockReturnValue(false)
    renderMenu()
    const sheet = await openConfirmSheet()

    await userEvent.click(within(sheet).getByRole('button', { name: '削除する' }))

    // push すると削除済みの詳細が直前の履歴に残り、戻ると 404 になる
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/', replace: true }))
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('0 行なら既に削除済みとして扱い、エラーにしない', async () => {
    mockDeleteResult.mockResolvedValue({ data: [], error: null })
    renderMenu()
    const sheet = await openConfirmSheet()

    await userEvent.click(within(sheet).getByRole('button', { name: '削除する' }))

    await waitFor(() => expect(mockBack).toHaveBeenCalledOnce())
    expect(mockToast).toHaveBeenCalledWith('投稿は既に削除されています')
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('失敗したら遷移せず、もう一度押せる状態に戻す', async () => {
    mockDeleteResult.mockResolvedValue({ data: null, error: { message: 'boom' } })
    renderMenu()
    const sheet = await openConfirmSheet()
    const confirm = within(sheet).getByRole('button', { name: '削除する' })

    await userEvent.click(confirm)

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('削除に失敗しました'))
    expect(mockBack).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockInvalidatePostLists).not.toHaveBeenCalled()
    // シートが開いたまま、同じボタンをもう一度押せること
    expect(screen.getByText('投稿を削除しますか？')).toBeInTheDocument()
    expect(confirm).not.toBeDisabled()
  })
})
