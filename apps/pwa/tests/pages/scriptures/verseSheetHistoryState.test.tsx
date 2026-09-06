import { describe, it, expect } from 'vitest'
import {
  createRootRoute,
  createRoute,
  createRouter,
  createBrowserHistory,
  Outlet,
} from '@tanstack/react-router'

// 章ページは navigate の state にマーカーを書き、閉じるときは native の
// window.history.state から読む。この2つが繋がっていることが実装の前提なので、
// TanStack Router 側の挙動として固定する
describe('シート由来マーカーと window.history.state', () => {
  function buildRouter() {
    const root = createRootRoute({ component: () => <Outlet />, notFoundComponent: () => null })
    const chapter = createRoute({
      getParentRoute: () => root,
      path: '/scriptures/$collection/$book/$chapter',
      component: () => null,
      validateSearch: (search: Record<string, unknown>) => ({
        comment: search.comment === undefined ? undefined : Number(search.comment),
      }),
    })
    return createRouter({
      routeTree: root.addChildren([chapter]),
      history: createBrowserHistory(),
    })
  }

  const chapterParams = { collection: 'bofm', book: '1-ne', chapter: '3' }
  const to = '/scriptures/$collection/$book/$chapter' as const

  it('navigate の state で書いたマーカーが window.history.state から読める', async () => {
    window.history.replaceState({}, '', '/scriptures/bofm/1-ne/3')
    const router = buildRouter()
    await router.load()

    await router.navigate({
      to,
      params: chapterParams,
      search: { comment: 7 },
      state: (prev) => ({ ...prev, mannaVerseSheet: true }),
    })

    expect(window.location.search).toBe('?comment=7')
    expect((window.history.state as { mannaVerseSheet?: true }).mannaVerseSheet).toBe(true)
  })

  it('マーカーを載せない navigate では window.history.state に付かない', async () => {
    window.history.replaceState({}, '', '/scriptures/bofm/1-ne/3')
    const router = buildRouter()
    await router.load()

    await router.navigate({ to, params: chapterParams, search: { comment: 7 } })

    expect(
      (window.history.state as { mannaVerseSheet?: true }).mannaVerseSheet,
    ).toBeUndefined()
  })

  it('back すると URL もマーカーも1つ前の状態に戻る', async () => {
    window.history.replaceState({}, '', '/scriptures/bofm/1-ne/3')
    const router = buildRouter()
    await router.load()

    await router.navigate({
      to,
      params: chapterParams,
      search: { comment: 7 },
      state: (prev) => ({ ...prev, mannaVerseSheet: true }),
    })
    expect(router.history.canGoBack()).toBe(true)

    router.history.back()
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(window.location.search).toBe('')
    expect(
      (window.history.state as { mannaVerseSheet?: true }).mannaVerseSheet,
    ).toBeUndefined()
  })
})
