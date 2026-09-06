import type { PostWithUser } from '@/entities/post'
import { resolveUserIdentity } from '@/shared/lib/constants'
import type { AvatarStackItem } from '@/shared/ui'

export type VerseCommentEntry = {
  // この節から始まる連続した塊を持つ投稿。印を描くのはここだけ。
  // 「15, 18, 20節」のような飛び番は 15・18・20 の3箇所がアンカーになる
  anchored: PostWithUser[]
  // この節を含むすべての投稿。範囲でまたいでいる投稿も入る
  covered: PostWithUser[]
  // anchored の投稿者を重複なく並べたもの（アバター重ね用）
  commenters: AvatarStackItem[]
  // この節の印にホバーしたとき塗る節。アンカーが1件のときだけその投稿の対象節を持つ。
  // 複数あると範囲がばらばらで、統合するとどの投稿の範囲でもなくなるため空にする
  highlightVerses: number[]
}

export type VerseCommentIndex = Map<number, VerseCommentEntry>

function entryFor(index: VerseCommentIndex, verse: number): VerseCommentEntry {
  const existing = index.get(verse)
  if (existing) return existing
  const created: VerseCommentEntry = {
    anchored: [],
    covered: [],
    commenters: [],
    highlightVerses: [],
  }
  index.set(verse, created)
  return created
}

export function buildVerseCommentIndex(posts: PostWithUser[]): VerseCommentIndex {
  const index: VerseCommentIndex = new Map()

  for (const post of posts) {
    const verses = post.scripture_verses
    if (!verses?.length) continue

    const sorted = [...new Set(verses)].sort((a, b) => a - b)
    for (const [i, verse] of sorted.entries()) {
      const entry = entryFor(index, verse)
      entry.covered.push(post)
      if (i === 0 || sorted[i - 1] !== verse - 1) entry.anchored.push(post)
    }
  }

  for (const entry of index.values()) {
    if (entry.anchored.length === 1) {
      entry.highlightVerses = [...(entry.anchored[0].scripture_verses ?? [])].sort(
        (a, b) => a - b,
      )
    }

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
