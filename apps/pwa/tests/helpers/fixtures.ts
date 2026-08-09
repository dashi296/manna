import { screen } from '@testing-library/react'
import type { PostWithUser } from '@/entities/post'

export const makePost = (overrides: Partial<PostWithUser> = {}): PostWithUser => ({
  id: 'p1',
  content: '投稿',
  visibility: 'public',
  created_at: '2026-07-25T10:00:00+00:00',
  updated_at: '2026-07-25T10:00:00+00:00',
  scripture_collection: null,
  scripture_book: null,
  scripture_chapter: null,
  scripture_verses: null,
  user_id: 'u1',
  users: { display_name: '山田花子', avatar_url: null },
  ...overrides,
})

export const postsPage = (posts: PostWithUser[], nextCursor: unknown = null) => ({
  posts,
  nextCursor,
})

export const cursorAt = (id: string) => ({ createdAt: '2026-07-25T10:00:00+00:00', id })

export const loadMoreButton = () => screen.getByRole('button', { name: 'もっと見る' })
