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

  it('範囲をまたぐ投稿がある節は spanning になる', () => {
    const index = buildVerseCommentIndex([post('p1', 'u1', [3, 4, 5])])

    expect(index.get(3)?.spanning).toBe(true)
    expect(index.get(5)?.spanning).toBe(true)
  })

  it('単節の投稿だけの節は spanning にならない', () => {
    const index = buildVerseCommentIndex([post('p1', 'u1', [3])])

    expect(index.get(3)?.spanning).toBe(false)
  })

  it('scripture_verses が空・null の投稿は無視する', () => {
    const index = buildVerseCommentIndex([post('p1', 'u1', null), post('p2', 'u2', [])])

    expect(index.size).toBe(0)
  })
})
