import type { PostWithUser } from '@/entities/post'
import { resolveUserIdentity } from '@/shared/lib/constants'
import type { AvatarStackItem } from '@/shared/ui'

export type VerseCommentEntry = {
  // この節から始まる（= scripture_verses の最小値がこの節の）投稿。印を描くのはここだけ
  anchored: PostWithUser[]
  // この節を含むすべての投稿。範囲でまたいでいる投稿も入る
  covered: PostWithUser[]
  // anchored の投稿者を重複なく並べたもの（アバター重ね用）
  commenters: AvatarStackItem[]
  // covered に複数節の投稿が含まれるか。範囲を示す縦線を引くかの判定に使う
  spanning: boolean
}

export type VerseCommentIndex = Map<number, VerseCommentEntry>

function entryFor(index: VerseCommentIndex, verse: number): VerseCommentEntry {
  const existing = index.get(verse)
  if (existing) return existing
  const created: VerseCommentEntry = {
    anchored: [],
    covered: [],
    commenters: [],
    spanning: false,
  }
  index.set(verse, created)
  return created
}

export function buildVerseCommentIndex(posts: PostWithUser[]): VerseCommentIndex {
  const index: VerseCommentIndex = new Map()

  for (const post of posts) {
    const verses = post.scripture_verses
    if (!verses?.length) continue

    for (const verse of verses) {
      const entry = entryFor(index, verse)
      entry.covered.push(post)
      if (verses.length > 1) entry.spanning = true
    }
    entryFor(index, Math.min(...verses)).anchored.push(post)
  }

  for (const entry of index.values()) {
    const seen = new Set<string>()
    for (const post of entry.anchored) {
      if (seen.has(post.user_id)) continue
      seen.add(post.user_id)
      const { displayName, avatarUrl } = resolveUserIdentity(post.users)
      entry.commenters.push({ userId: post.user_id, name: displayName, avatarUrl })
    }
  }

  return index
}
