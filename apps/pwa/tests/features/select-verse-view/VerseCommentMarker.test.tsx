import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VerseCommentMarker } from '@/features/select-verse-view'

const alice = { userId: 'u1', name: 'アリス', avatarUrl: null }
const bob = { userId: 'u2', name: 'ボブ', avatarUrl: null }
const carol = { userId: 'u3', name: 'キャロル', avatarUrl: null }
const dave = { userId: 'u4', name: 'デイブ', avatarUrl: null }

// 重なり順は --stack-z で渡し、z-(--stack-z) が参照する
const stackZ = (el: HTMLElement) => Number(el.style.getPropertyValue('--stack-z') || 0)

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

  it('コメントが1件なら件数バッジを出さない', () => {
    render(<VerseCommentMarker entry={{ anchoredCount: 1, commenters: [alice] }} />)

    expect(screen.queryByText('1')).toBeNull()
  })

  it('アバターは3人までに抑え、残りは件数表示に任せる', () => {
    render(
      <VerseCommentMarker entry={{ anchoredCount: 4, commenters: [alice, bob, carol, dave] }} />,
    )

    expect(screen.getByText('ア')).toBeInTheDocument()
    expect(screen.getByText('キ')).toBeInTheDocument()
    expect(screen.queryByText('デ')).toBeNull()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('件数はアイコンの右上に重ねる', () => {
    // 件数を横に並べるとその分だけ列が広がり、聖文が圧迫される
    render(<VerseCommentMarker entry={{ anchoredCount: 3, commenters: [alice] }} />)

    const badge = screen.getByText('3')
    expect(badge).toHaveClass('absolute')
    expect(badge.parentElement).toHaveClass('relative')
  })

  it('件数バッジはアイコンより前面に出す', () => {
    // アバターは flex アイテムに z-index を直接持たせている。flex アイテムは
    // position: static でも z-index が効くため、指定の無いバッジは下に潜る
    render(<VerseCommentMarker entry={{ anchoredCount: 3, commenters: [alice, bob, carol] }} />)

    const badge = screen.getByText('3')
    const wrapper = badge.parentElement!
    const avatarZ = Array.from(
      wrapper.querySelectorAll<HTMLElement>(':scope > span:not(.absolute)'),
    ).map(stackZ)

    expect(stackZ(badge)).toBeGreaterThan(Math.max(...avatarZ))
    expect(badge).toHaveClass('z-(--stack-z)')
  })

  it('コメントのない節では幅だけ確保する', () => {
    const { container } = render(<VerseCommentMarker entry={undefined} />)

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
    expect(screen.queryByText('ア')).toBeNull()
  })

  it('範囲の途中の節（entry はあるが anchoredCount=0）でも幅だけ確保する', () => {
    // 複数節の投稿では、アンカー以外の節にも covered/commenters 目的で entry が渡る
    const { container } = render(
      <VerseCommentMarker entry={{ anchoredCount: 0, commenters: [] }} />,
    )

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
    expect(screen.queryByText('ア')).toBeNull()
  })
})
