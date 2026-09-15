import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VerseCommentMarker } from '@/features/select-verse-view'

const alice = { userId: 'u1', name: 'アリス', avatarUrl: null }
const bob = { userId: 'u2', name: 'ボブ', avatarUrl: null }

describe('VerseCommentMarker', () => {
  it('押せる要素を描画しない', () => {
    render(<VerseCommentMarker entry={{ anchoredCount: 1, commenters: [alice] }} />)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('アンカー節では投稿者アバターを描画する', () => {
    render(<VerseCommentMarker entry={{ anchoredCount: 1, commenters: [alice] }} />)

    expect(screen.getByText('ア')).toBeInTheDocument()
  })

  it('2件以上なら件数バッジを出す', () => {
    render(<VerseCommentMarker entry={{ anchoredCount: 2, commenters: [alice, bob] }} />)

    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('コメントのない節では幅だけ確保する', () => {
    const { container } = render(<VerseCommentMarker entry={undefined} />)

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
    expect(screen.queryByText('ア')).toBeNull()
  })
})
