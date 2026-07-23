import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { routeComponent } from '../../helpers/tanstack'

const loaderData = {
  id: 'bofm',
  name: 'モルモン書',
  books: [
    { id: 'introduction', name: '序文', chapters: 1, verses: [9], isFrontMatter: true },
    { id: '1-ne', name: '第1ニーファイ書', chapters: 22, verses: [20] },
  ],
}

vi.mock('@tanstack/react-router', async () =>
  (await import('../../helpers/tanstack')).routerMock(() => loaderData),
)

describe('CollectionPage', () => {
  it('front matter の書は章数を表示しない', async () => {
    const CollectionPage = routeComponent(await import('@/pages/scriptures/$collection/index'))
    render(<CollectionPage />)
    expect(screen.getByRole('link', { name: /序文/ })).toBeInTheDocument()
    expect(screen.queryByText(/1章/)).toBeNull()
  })

  it('通常の書は章数を表示する', async () => {
    const CollectionPage = routeComponent(await import('@/pages/scriptures/$collection/index'))
    render(<CollectionPage />)
    expect(screen.getByText('22章 ›')).toBeInTheDocument()
  })
})
