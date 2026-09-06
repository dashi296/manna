import { afterEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VerseCommentGutter } from '@/features/select-verse-view/ui/VerseCommentGutter'

const alice = { userId: 'u1', name: 'アリス', avatarUrl: null }
const bob = { userId: 'u2', name: 'ボブ', avatarUrl: null }
const carol = { userId: 'u3', name: 'キャロル', avatarUrl: null }
const dave = { userId: 'u4', name: 'デイブ', avatarUrl: null }

describe('VerseCommentGutter 長押し', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const anchorEntry = {
    anchoredCount: 1,
    commenters: [alice],
    highlightVerses: [3, 4, 5],
  }

  it('短く押して離せばシートが開く', () => {
    vi.useFakeTimers()
    const onOpen = vi.fn()
    render(<VerseCommentGutter verse={3} entry={anchorEntry} onOpen={onOpen} />)

    const btn = screen.getByRole('button', { name: /3節/ })
    fireEvent.pointerDown(btn)
    vi.advanceTimersByTime(120)
    fireEvent.pointerUp(btn)
    fireEvent.click(btn)

    expect(onOpen).toHaveBeenCalledWith(3)
  })

  it('キーボード操作（pointerdown を伴わない click）でもシートが開く', () => {
    const onOpen = vi.fn()
    render(<VerseCommentGutter verse={3} entry={anchorEntry} onOpen={onOpen} />)

    fireEvent.click(screen.getByRole('button', { name: /3節/ }))

    expect(onOpen).toHaveBeenCalledWith(3)
  })

  it('長押しして離してもシートは開かない', () => {
    vi.useFakeTimers()
    const onOpen = vi.fn()
    render(<VerseCommentGutter verse={3} entry={anchorEntry} onOpen={onOpen} />)

    const btn = screen.getByRole('button', { name: /3節/ })
    fireEvent.pointerDown(btn)
    vi.advanceTimersByTime(800)
    fireEvent.pointerUp(btn)
    fireEvent.click(btn)

    expect(onOpen).not.toHaveBeenCalled()
  })

  it('押下したまま外へ離脱した後、キーボード操作でシートが開く', () => {
    vi.useFakeTimers()
    const onOpen = vi.fn()
    render(<VerseCommentGutter verse={3} entry={anchorEntry} onOpen={onOpen} />)

    const btn = screen.getByRole('button', { name: /3節/ })
    // 押しかけてポインタを外へ移動（クリックは発生しない）
    fireEvent.pointerDown(btn)
    fireEvent.pointerLeave(btn)
    vi.advanceTimersByTime(5000)

    // その後キーボードで開く
    fireEvent.click(btn)

    expect(onOpen).toHaveBeenCalledWith(3)
  })

  it('タッチのように pointerleave が click より先に来ても長押しは効く', () => {
    vi.useFakeTimers()
    const onOpen = vi.fn()
    render(<VerseCommentGutter verse={3} entry={anchorEntry} onOpen={onOpen} />)

    const btn = screen.getByRole('button', { name: /3節/ })
    fireEvent.pointerDown(btn)
    vi.advanceTimersByTime(800)
    fireEvent.pointerUp(btn)
    fireEvent.pointerLeave(btn)
    fireEvent.click(btn)

    expect(onOpen).not.toHaveBeenCalled()
  })

  it('タッチのように pointerleave が click より先に来ても短押しは開く', () => {
    vi.useFakeTimers()
    const onOpen = vi.fn()
    render(<VerseCommentGutter verse={3} entry={anchorEntry} onOpen={onOpen} />)

    const btn = screen.getByRole('button', { name: /3節/ })
    fireEvent.pointerDown(btn)
    vi.advanceTimersByTime(100)
    fireEvent.pointerUp(btn)
    fireEvent.pointerLeave(btn)
    fireEvent.click(btn)

    expect(onOpen).toHaveBeenCalledWith(3)
  })

  it('塗る範囲が無い印は長押しでもシートを開く（無操作にしない）', () => {
    vi.useFakeTimers()
    const onOpen = vi.fn()
    // 同じ節に複数投稿がアンカーされると highlightVerses は空になる
    render(
      <VerseCommentGutter
        verse={3}
        entry={{ anchoredCount: 2, commenters: [alice, bob], highlightVerses: [] }}
        onOpen={onOpen}
      />,
    )

    const btn = screen.getByRole('button', { name: /3節/ })
    fireEvent.pointerDown(btn)
    vi.advanceTimersByTime(800)
    fireEvent.pointerUp(btn)
    fireEvent.click(btn)

    expect(onOpen).toHaveBeenCalledWith(3)
  })

  it('長押しの後でも次の短い押下ならシートが開く', () => {
    vi.useFakeTimers()
    const onOpen = vi.fn()
    render(<VerseCommentGutter verse={3} entry={anchorEntry} onOpen={onOpen} />)

    const btn = screen.getByRole('button', { name: /3節/ })
    fireEvent.pointerDown(btn)
    vi.advanceTimersByTime(800)
    fireEvent.pointerUp(btn)
    fireEvent.click(btn)

    fireEvent.pointerDown(btn)
    vi.advanceTimersByTime(100)
    fireEvent.pointerUp(btn)
    fireEvent.click(btn)

    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('押している最中にポインタがキャンセルされてもハイライトが残らない', () => {
    const onHighlight = vi.fn()
    render(
      <VerseCommentGutter
        verse={3}
        entry={anchorEntry}
        onOpen={vi.fn()}
        onHighlight={onHighlight}
      />,
    )

    const btn = screen.getByRole('button', { name: /3節/ })
    fireEvent.pointerEnter(btn)
    fireEvent.pointerDown(btn)
    fireEvent.pointerCancel(btn)

    expect(onHighlight).toHaveBeenLastCalledWith(null)
  })

  it('長押し中の OS のコンテキストメニューを抑止する', () => {
    render(<VerseCommentGutter verse={3} entry={anchorEntry} onOpen={vi.fn()} />)

    const btn = screen.getByRole('button', { name: /3節/ })
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    fireEvent(btn, event)

    expect(event.defaultPrevented).toBe(true)
  })
})

describe('VerseCommentGutter', () => {
  it('コメントのない節では押せる要素を描画しない', () => {
    render(<VerseCommentGutter verse={4} entry={undefined} onOpen={vi.fn()} />)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('アンカー節では投稿者アバターを描画する', () => {
    render(
      <VerseCommentGutter
        verse={3}
        entry={{ anchoredCount: 1, commenters: [alice] }}
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
        entry={{ anchoredCount: 4, commenters: [alice, bob, carol, dave] }}
        onOpen={vi.fn()}
      />,
    )

    expect(screen.getByText('ア')).toBeInTheDocument()
    expect(screen.getByText('キ')).toBeInTheDocument()
    expect(screen.queryByText('デ')).toBeNull()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('継続節には押せる要素を置かない（見た目が空のフォーカス地点を作らない）', () => {
    render(
      <VerseCommentGutter
        verse={5}
        entry={{ anchoredCount: 0, commenters: [] }}
        onOpen={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByText('3')).toBeNull()
  })

  it('印にホバーするとその投稿の対象節を通知し、離れると解除する', async () => {
    const onHighlight = vi.fn()
    render(
      <VerseCommentGutter
        verse={3}
        entry={{
          anchoredCount: 1,
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

  it('継続節はホバーしてもハイライトを起こさない', async () => {
    const onHighlight = vi.fn()
    const { container } = render(
      <VerseCommentGutter
        verse={5}
        entry={{ anchoredCount: 0, commenters: [], highlightVerses: [] }}
        onOpen={vi.fn()}
        onHighlight={onHighlight}
      />,
    )

    await userEvent.hover(container.firstElementChild!)

    expect(onHighlight).not.toHaveBeenCalled()
  })

  it('件数はその節から始まる投稿の数を示し、アバターの人数と食い違わない', () => {
    render(
      <VerseCommentGutter
        verse={7}
        entry={{ anchoredCount: 1, commenters: [alice] }}
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
        entry={{ anchoredCount: 3, commenters: [alice] }}
        onOpen={vi.fn()}
      />,
    )

    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('コメントが1件なら件数を表示しない', () => {
    render(
      <VerseCommentGutter
        verse={3}
        entry={{ anchoredCount: 1, commenters: [alice] }}
        onOpen={vi.fn()}
      />,
    )

    expect(screen.queryByText('1')).toBeNull()
  })

  it('押すと節番号を伴って onOpen が呼ばれる', async () => {
    const onOpen = vi.fn()
    render(
      <VerseCommentGutter
        verse={5}
        entry={{ anchoredCount: 1, commenters: [alice] }}
        onOpen={onOpen}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /5節/ }))

    expect(onOpen).toHaveBeenCalledWith(5)
  })
})
