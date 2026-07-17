export type PostWithUser = {
  id: string
  content: string
  visibility: string
  created_at: string
  scripture_collection: string | null
  scripture_book: string | null
  scripture_chapter: number | null
  scripture_verses: number[] | null
  user_id: string
  users: { display_name: string | null; avatar_url: string | null } | null
}

export const POST_SELECT = `
  id, content, visibility, created_at,
  scripture_collection, scripture_book, scripture_chapter,
  scripture_verses, user_id,
  users ( display_name, avatar_url )
`

export function toScriptureRef(post: PostWithUser) {
  return post.scripture_collection && post.scripture_book && post.scripture_chapter
    ? { collection: post.scripture_collection, book: post.scripture_book, chapter: post.scripture_chapter, verses: post.scripture_verses ?? undefined }
    : null
}
