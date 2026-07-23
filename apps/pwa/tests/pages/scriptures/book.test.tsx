import { describe, it, expect, vi } from 'vitest'

vi.mock('@tanstack/react-router', async () =>
  (await import('../../helpers/tanstack')).routerMock(),
)

describe('BookPage loader', () => {
  it('front matter の書は第1章へリダイレクトする', async () => {
    const mod = await import('@/pages/scriptures/$collection/$book/index')
    const Route = mod.Route as unknown as {
      loader: (ctx: { params: { collection: string; book: string } }) => unknown
    }
    let thrown: unknown
    try {
      Route.loader({ params: { collection: 'bofm', book: 'introduction' } })
    } catch (e) {
      thrown = e
    }
    expect(thrown).toEqual({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection: 'bofm', book: 'introduction', chapter: '1' },
    })
  })

  it('通常の書はリダイレクトせず book/collection を返す', async () => {
    const mod = await import('@/pages/scriptures/$collection/$book/index')
    const Route = mod.Route as unknown as {
      loader: (ctx: { params: { collection: string; book: string } }) => {
        book: { id: string }
        collection: { id: string }
      }
    }
    const result = Route.loader({ params: { collection: 'bofm', book: '1-ne' } })
    expect(result.book.id).toBe('1-ne')
    expect(result.collection.id).toBe('bofm')
  })
})
