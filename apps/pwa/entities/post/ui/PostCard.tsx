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

type Props = { post: PostWithUser }

export function PostCard({ post }: Props) {
  return (
    <div className="border-b px-4 py-3">
      <p className="text-sm whitespace-pre-wrap">{post.content}</p>
    </div>
  )
}
