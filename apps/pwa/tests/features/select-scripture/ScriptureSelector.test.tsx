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
