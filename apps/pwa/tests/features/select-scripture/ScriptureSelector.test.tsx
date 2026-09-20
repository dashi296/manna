import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScriptureSelector } from '@/features/select-scripture'

const chapterRef = { collection: 'bofm', book: 'mosiah', chapter: 3 }

describe('ScriptureSelector', () => {
  it('既定では聖典集・書籍・章のセレクタを描画する', () => {
    render(<ScriptureSelector value={chapterRef} onChange={() => {}} />)

    expect(screen.getAllByRole('combobox')).toHaveLength(3)
  })

  // 節の入力欄は value.verses を写した state を持つ。外から値が変わったら
  // 追従する必要がある（effect ではなくレンダー中に調整している）
  it('外から value.verses が変わると節の入力欄が追従する', () => {
    const { rerender } = render(
      <ScriptureSelector value={{ ...chapterRef, verses: [7] }} onChange={() => {}} lockRef />,
    )
    expect(screen.getByPlaceholderText(/節/)).toHaveValue('7')

    rerender(
      <ScriptureSelector value={{ ...chapterRef, verses: [11, 13] }} onChange={() => {}} lockRef />,
    )
    expect(screen.getByPlaceholderText(/節/)).toHaveValue('11, 13')

    // 空になる向きも追従する（「空への変更だけ無視する」実装を弾く）
    rerender(
      <ScriptureSelector
        value={{ ...chapterRef, verses: undefined }}
        onChange={() => {}}
        lockRef
      />,
    )
    expect(screen.getByPlaceholderText(/節/)).toHaveValue('')
  })

  // 外の値が同じままなら、利用者が打った内容を上書きしない
  it('value.verses が変わらない再描画では入力中の内容を保つ', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <ScriptureSelector value={{ ...chapterRef, verses: [7] }} onChange={() => {}} lockRef />,
    )
    const input = screen.getByPlaceholderText(/節/)
    await user.clear(input)
    await user.type(input, '20')

    rerender(
      <ScriptureSelector value={{ ...chapterRef, verses: [7] }} onChange={() => {}} lockRef />,
    )
    expect(input).toHaveValue('20')
  })

  it('lockRef 時は聖典集・書籍・章のセレクタを描画しない', () => {
    render(<ScriptureSelector value={chapterRef} onChange={() => {}} lockRef />)

    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
  })

  it('lockRef 時も節は編集でき、固定の参照を保ったまま onChange される', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ScriptureSelector value={chapterRef} onChange={onChange} lockRef />)

    await user.type(screen.getByPlaceholderText(/節/), '7, 9')
    await user.tab()

    expect(onChange).toHaveBeenCalledWith({ ...chapterRef, verses: [7, 9] })
  })
})
