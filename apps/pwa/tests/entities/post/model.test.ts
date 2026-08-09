import { describe, it, expect } from 'vitest'
import { toScriptureRef, POST_SELECT, type PostWithUser } from '@/entities/post/model'

function makePost(overrides: Partial<PostWithUser> = {}): PostWithUser {
  return {
    id: '1',
    content: 'test',
    visibility: 'public',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    scripture_collection: null,
    scripture_book: null,
    scripture_chapter: null,
    scripture_verses: null,
    user_id: 'u1',
    users: null,
    ...overrides,
  }
}

describe('toScriptureRef', () => {
  it('collection/book/chapterが全て揃っている場合にオブジェクトを返す', () => {
    const post = makePost({
      scripture_collection: 'bofm',
      scripture_book: '1-ne',
      scripture_chapter: 3,
      scripture_verses: [1, 5],
    })
    expect(toScriptureRef(post)).toEqual({
      collection: 'bofm',
      book: '1-ne',
      chapter: 3,
      verses: [1, 5],
    })
  })

  it('versesがnullの場合はundefinedにする', () => {
    const post = makePost({
      scripture_collection: 'bofm',
      scripture_book: '1-ne',
      scripture_chapter: 1,
      scripture_verses: null,
    })
    const ref = toScriptureRef(post)
    expect(ref).not.toBeNull()
    expect(ref!.verses).toBeUndefined()
  })

  it('collectionがnullの場合はnullを返す', () => {
    const post = makePost({ scripture_book: '1-ne', scripture_chapter: 1 })
    expect(toScriptureRef(post)).toBeNull()
  })

  it('bookがnullの場合はnullを返す', () => {
    const post = makePost({ scripture_collection: 'bofm', scripture_chapter: 1 })
    expect(toScriptureRef(post)).toBeNull()
  })

  it('chapterがnullの場合はnullを返す', () => {
    const post = makePost({ scripture_collection: 'bofm', scripture_book: '1-ne' })
    expect(toScriptureRef(post)).toBeNull()
  })

  it('聖典参照が全てnullの場合はnullを返す', () => {
    expect(toScriptureRef(makePost())).toBeNull()
  })
})

describe('POST_SELECT', () => {
  it('updated_at を含む（「編集済み」表示が created_at との比較に使う）', () => {
    expect(POST_SELECT).toContain('updated_at')
  })
})
