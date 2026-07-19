import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChapterCommentersRow } from '@/features/select-verse-view/ui/ChapterCommentersRow'

const commenters = [
  { userId: 'u1', name: '中村さん', avatarUrl: null },
  { userId: 'u2', name: '田中さん', avatarUrl: null },
]

describe('ChapterCommentersRow', () => {
  it('コメンターが空なら案内文言を表示、ボタンは出さない', () => {
    render(
      <ChapterCommentersRow
        commenters={[]}
        selectedUserId={null}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    expect(
      screen.getByText('フォロー中／家族のこの章への投稿はまだありません'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('各コメンターをボタンで描画する', () => {
    render(
      <ChapterCommentersRow
        commenters={commenters}
        selectedUserId={null}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '中村さん を選ぶ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '田中さん を選ぶ' })).toBeInTheDocument()
  })

  it('コメンターをクリックで onSelect を該当 ID で呼ぶ', async () => {
    const onSelect = vi.fn()
    render(
      <ChapterCommentersRow
        commenters={commenters}
        selectedUserId={null}
        onSelect={onSelect}
        onClear={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: '中村さん を選ぶ' }))
    expect(onSelect).toHaveBeenCalledWith('u1')
  })

  it('selectedUserId が指定されると解除ボタンが出て、押すと onClear', async () => {
    const onClear = vi.fn()
    render(
      <ChapterCommentersRow
        commenters={commenters}
        selectedUserId="u1"
        onSelect={vi.fn()}
        onClear={onClear}
      />,
    )
    const clear = screen.getByRole('button', { name: '選択解除' })
    await userEvent.click(clear)
    expect(onClear).toHaveBeenCalled()
  })

  it('selectedUserId が指定されているとき、該当アバターに aria-pressed が付く', () => {
    render(
      <ChapterCommentersRow
        commenters={commenters}
        selectedUserId="u1"
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '中村さん を選ぶ' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: '田中さん を選ぶ' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})
