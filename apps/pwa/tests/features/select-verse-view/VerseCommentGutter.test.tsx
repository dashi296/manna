import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VerseCommentGutter } from '@/features/select-verse-view/ui/VerseCommentGutter'

const alice = { userId: 'u1', name: 'アリス', avatarUrl: null }
const bob = { userId: 'u2', name: 'ボブ', avatarUrl: null }
const carol = { userId: 'u3', name: 'キャロル', avatarUrl: null }
const dave = { userId: 'u4', name: 'デイブ', avatarUrl: null }

describe('VerseCommentGutter', () => {
  it('コメントのない節では押せる要素を描画しない', () => {
    render(<VerseCommentGutter verse={4} entry={undefined} onOpen={vi.fn()} />)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('アンカー節では投稿者アバターを描画する', () => {
    render(
      <VerseCommentGutter
        verse={3}
        entry={{ anchoredCount: 1, coveredCount: 1, commenters: [alice] }}
        onOpen={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /3節/ })).toBeInTheDocument()
    expect(screen.getByText('ア')).toBeInTheDocument()
  })

  it('アバターは3人までに抑え、残りは件数表示に任せる', () => {
    render(
      <VerseCommentGutter
        verse={3}
        entry={{ anchoredCount: 4, coveredCount: 4, commenters: [alice, bob, carol, dave] }}
        onOpen={vi.fn()}
      />,
    )

    expect(screen.getByText('ア')).toBeInTheDocument()
    expect(screen.getByText('キ')).toBeInTheDocument()
    expect(screen.queryByText('デ')).toBeNull()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('継続節では件数を表示しない', () => {
    render(
      <VerseCommentGutter
        verse={5}
        entry={{ anchoredCount: 0, coveredCount: 3, commenters: [] }}
        onOpen={vi.fn()}
      />,
    )

    expect(screen.queryByText('3')).toBeNull()
  })

  it('印にホバーするとその投稿の対象節を通知し、離れると解除する', async () => {
    const onHighlight = vi.fn()
    render(
      <VerseCommentGutter
        verse={3}
        entry={{
          anchoredCount: 1,
          coveredCount: 1,
          commenters: [alice],
          highlightVerses: [3, 4, 5],
        }}
        onOpen={vi.fn()}
        onHighlight={onHighlight}
      />,
    )

    const btn = screen.getByRole('button', { name: /3節/ })
    await userEvent.hover(btn)
    expect(onHighlight).toHaveBeenLastCalledWith([3, 4, 5])

    await userEvent.unhover(btn)
    expect(onHighlight).toHaveBeenLastCalledWith(null)
  })

  it('継続節の印にホバーしても何もハイライトしない', async () => {
    const onHighlight = vi.fn()
    render(
      <VerseCommentGutter
        verse={5}
        entry={{ anchoredCount: 0, coveredCount: 1, commenters: [], highlightVerses: [] }}
        onOpen={vi.fn()}
        onHighlight={onHighlight}
      />,
    )

    await userEvent.hover(screen.getByRole('button', { name: /5節/ }))

    expect(onHighlight).not.toHaveBeenCalledWith(expect.arrayContaining([expect.any(Number)]))
  })

  it('件数はその節から始まる投稿の数を示し、アバターの人数と食い違わない', () => {
    render(
      <VerseCommentGutter
        verse={7}
        entry={{ anchoredCount: 1, coveredCount: 3, commenters: [alice] }}
        onOpen={vi.fn()}
      />,
    )

    expect(screen.getByText('ア')).toBeInTheDocument()
    expect(screen.queryByText('3')).toBeNull()
  })

  it('コメントが2件以上なら件数を表示する', () => {
    render(
      <VerseCommentGutter
        verse={3}
        entry={{ anchoredCount: 3, coveredCount: 3, commenters: [alice] }}
        onOpen={vi.fn()}
      />,
    )

    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('コメントが1件なら件数を表示しない', () => {
    render(
      <VerseCommentGutter
        verse={3}
        entry={{ anchoredCount: 1, coveredCount: 1, commenters: [alice] }}
        onOpen={vi.fn()}
      />,
    )

    expect(screen.queryByText('1')).toBeNull()
  })

  it('継続節ではアバターを描画せず、押せる要素だけ残す', () => {
    render(
      <VerseCommentGutter
        verse={5}
        entry={{ anchoredCount: 0, coveredCount: 1, commenters: [] }}
        onOpen={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /5節/ })).toBeInTheDocument()
    expect(screen.queryByText('ア')).toBeNull()
  })

  it('押すと節番号を伴って onOpen が呼ばれる', async () => {
    const onOpen = vi.fn()
    render(
      <VerseCommentGutter
        verse={5}
        entry={{ anchoredCount: 0, coveredCount: 2, commenters: [] }}
        onOpen={onOpen}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /5節/ }))

    expect(onOpen).toHaveBeenCalledWith(5)
  })
})
