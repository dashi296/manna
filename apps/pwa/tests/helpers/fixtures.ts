import { screen } from '@testing-library/react'

export const makePost = (
  id: string,
  content: string,
  overrides: Record<string, unknown> = {},
) => ({
  id,
  content,
  visibility: 'public',
  created_at: '2026-07-25T10:00:00+00:00',
  scripture_collection: null,
  scripture_book: null,
  scripture_chapter: null,
  scripture_verses: null,
  user_id: 'u1',
  users: { display_name: '山田花子', avatar_url: null },
  ...overrides,
})

export const cursorAt = (id: string) => ({ createdAt: '2026-07-25T10:00:00+00:00', id })

export const loadMoreButton = () => screen.getByRole('button', { name: 'もっと見る' })
