import { describe, it, expect } from 'vitest'
import { buildVerseCommentIndex } from '@/features/select-verse-view/model/verseCommentIndex'
import type { PostWithUser } from '@/entities/post'

function post(id: string, userId: string, verses: number[] | null): PostWithUser {
  return {
    id,
    user_id: userId,
    scripture_verses: verses,
    users: { id: userId, display_name: `user-${userId}`, avatar_url: null },
  } as unknown as PostWithUser
}

describe('buildVerseCommentIndex', () => {
  it('複数節の投稿は最小節にだけアンカーされる', () => {
    const index = buildVerseCommentIndex([post('p1', 'u1', [3, 4, 5, 6, 7])])

    expect(index.get(3)?.anchored).toEqual([expect.objectContaining({ id: 'p1' })])
    expect(index.get(4)?.anchored).toEqual([])
    expect(index.get(7)?.anchored).toEqual([])
  })

  it('範囲内の各節は covered になり、その節に関わる投稿を全件持つ', () => {
    const index = buildVerseCommentIndex([post('p1', 'u1', [3, 4, 5])])

    expect(index.get(4)?.covered).toEqual([expect.objectContaining({ id: 'p1' })])
    expect(index.get(6)).toBeUndefined()
  })

  it('飛び番の投稿は連続する塊ごとにアンカーされる', () => {
    const index = buildVerseCommentIndex([post('p1', 'u1', [15, 18, 20])])

    expect(index.get(15)?.anchored).toHaveLength(1)
    expect(index.get(18)?.anchored).toHaveLength(1)
    expect(index.get(20)?.anchored).toHaveLength(1)
  })

  it('連続する塊の途中の節はアンカーにならない', () => {
    const index = buildVerseCommentIndex([post('p1', 'u1', [3, 4, 5, 8, 9])])

    expect(index.get(3)?.anchored).toHaveLength(1)
    expect(index.get(8)?.anchored).toHaveLength(1)
    expect(index.get(4)?.anchored).toEqual([])
    expect(index.get(9)?.anchored).toEqual([])
  })

  it('節の順序が乱れていても塊を正しく判定する', () => {
    const index = buildVerseCommentIndex([post('p1', 'u1', [5, 3, 4])])

    expect(index.get(3)?.anchored).toHaveLength(1)
    expect(index.get(4)?.anchored).toEqual([])
    expect(index.get(5)?.anchored).toEqual([])
  })

  it('飛び番の投稿は間の節を covered にしない', () => {
    const index = buildVerseCommentIndex([post('p1', 'u1', [3, 5, 7])])

    expect(index.get(5)?.covered).toHaveLength(1)
    expect(index.get(4)).toBeUndefined()
  })

  it('同じ節に重なる複数投稿をまとめる', () => {
    const index = buildVerseCommentIndex([
      post('p1', 'u1', [3, 4, 5]),
      post('p2', 'u2', [5, 6]),
    ])

    expect(index.get(5)?.covered).toHaveLength(2)
    expect(index.get(5)?.anchored.map((p) => p.id)).toEqual(['p2'])
  })

  it('アンカー節の commenters は投稿者を重複なく返す', () => {
    const index = buildVerseCommentIndex([
      post('p1', 'u1', [3]),
      post('p2', 'u1', [3]),
      post('p3', 'u2', [3]),
    ])

    expect(index.get(3)?.commenters.map((c) => c.userId)).toEqual(['u1', 'u2'])
  })

  it('アンカー節はその投稿の全対象節を highlightVerses に持つ', () => {
    const index = buildVerseCommentIndex([post('p1', 'u1', [3, 4, 5])])

    expect(index.get(3)?.highlightVerses).toEqual([3, 4, 5])
  })

  it('飛び番はどの塊のアンカーからも投稿全体をハイライトする', () => {
    const index = buildVerseCommentIndex([post('p1', 'u1', [15, 18, 20])])

    expect(index.get(18)?.highlightVerses).toEqual([15, 18, 20])
  })

  it('同じ節に複数投稿がアンカーされたら対象節を統合する', () => {
    const index = buildVerseCommentIndex([
      post('p1', 'u1', [3, 4]),
      post('p2', 'u2', [3, 9]),
    ])

    expect(index.get(3)?.highlightVerses).toEqual([3, 4, 9])
  })

  it('継続節は highlightVerses を持たない', () => {
    const index = buildVerseCommentIndex([post('p1', 'u1', [3, 4, 5])])

    expect(index.get(4)?.highlightVerses).toEqual([])
  })

  it('scripture_verses が空・null の投稿は無視する', () => {
    const index = buildVerseCommentIndex([post('p1', 'u1', null), post('p2', 'u2', [])])

    expect(index.size).toBe(0)
  })
})
