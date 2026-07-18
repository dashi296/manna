import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { routeComponent } from '../helpers/tanstack'

vi.mock('@tanstack/react-router', async () =>
  (await import('../helpers/tanstack')).routerMock(() => ({ publicPosts: [], followingPosts: [] })),
)

vi.mock('@tanstack/react-start', async () => (await import('../helpers/tanstack')).startMock())

describe('FeedPage', () => {
  it('タブ「全体」と「フォロー中」が表示される', async () => {
    const FeedPage = routeComponent(await import('@/pages/index'))
    render(<FeedPage />)
    expect(screen.getByText('フォロー中')).toBeInTheDocument()
    expect(screen.getByText('全体')).toBeInTheDocument()
  })
})
