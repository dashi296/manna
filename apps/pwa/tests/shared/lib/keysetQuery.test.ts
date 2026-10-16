import { describe, it, expect, vi, afterEach } from 'vitest'
import { QueryClient, InfiniteQueryObserver } from '@tanstack/react-query'
import { keysetInfiniteOptions, loadFirstPage } from '@/shared/lib/keysetQuery'
import type { Cursor } from '@/shared/lib/cursor'
import { deferred } from '../../helpers/deferred'

type Page = { items: string[]; nextCursor: Cursor | null }

const CURSOR: Cursor = { createdAt: '2026-10-01T00:00:00Z', id: 'c' }

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60 * 1000 } } })
  const fetchPage = vi.fn(async (cursor: Cursor | null): Promise<Page> => ({
    items: [cursor ? 'next' : 'first'],
    nextCursor: cursor ? null : CURSOR,
  }))
  const options = keysetInfiniteOptions(['feed'], fetchPage)
  return { queryClient, fetchPage, options }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('loadFirstPage', () => {
  // defaultPreloadStaleTime: 0 なので、hover の先読みとクリックで loader が2回走る
  it('先読みの直後にクリックしても取り直さない', async () => {
    const { queryClient, fetchPage, options } = setup()

    await loadFirstPage(queryClient, options)
    await loadFirstPage(queryClient, options)

    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('先読みが飛んでいる最中にクリックしたら、その取得を使い回す', async () => {
    const { queryClient, fetchPage, options } = setup()
    const pending = deferred<Page>()
    fetchPage.mockImplementationOnce(() => pending.promise)

    const preload = loadFirstPage(queryClient, options)
    await vi.waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1))
    const enter = loadFirstPage(queryClient, options)
    pending.resolve({ items: ['first'], nextCursor: CURSOR })

    await expect(preload).resolves.toMatchObject({ pages: [{ items: ['first'] }] })
    await expect(enter).resolves.toMatchObject({ pages: [{ items: ['first'] }] })
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('しばらく経ってから訪れたら取り直す（他人の変更を拾う）', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { queryClient, fetchPage, options } = setup()

    await loadFirstPage(queryClient, options)
    vi.setSystemTime(Date.now() + 60 * 1000)
    await loadFirstPage(queryClient, options)

    expect(fetchPage).toHaveBeenCalledTimes(2)
  })

  it('無効化されていたら、直後でも取り直す', async () => {
    const { queryClient, fetchPage, options } = setup()

    await loadFirstPage(queryClient, options)
    await queryClient.invalidateQueries({ queryKey: options.queryKey, refetchType: 'none' })
    await loadFirstPage(queryClient, options)

    expect(fetchPage).toHaveBeenCalledTimes(2)
  })

  // #83: 「もっと見る」の取得に相乗りすると、遷移がその完了待ちになり、追加分まで持ち込まれる
  it('「もっと見る」が飛んでいる最中に戻ってきたら、それを打ち切って1ページ目だけを返す', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { queryClient, fetchPage, options } = setup()
    await loadFirstPage(queryClient, options)
    // 使い回しの猶予は過ぎたが、画面側（staleTime 60 秒）は購読しても取り直さない時点
    vi.setSystemTime(Date.now() + 11 * 1000)

    const pending = deferred<Page>()
    fetchPage.mockImplementationOnce(() => pending.promise)
    const observer = new InfiniteQueryObserver(queryClient, options)
    const unsubscribe = observer.subscribe(() => {})
    void observer.fetchNextPage()
    await vi.waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2))

    // pending は解決しないまま。打ち切らなければここで止まる
    const data = await loadFirstPage(queryClient, options)
    unsubscribe()

    expect(fetchPage).toHaveBeenCalledTimes(3)
    expect(fetchPage).toHaveBeenLastCalledWith(null)
    expect(data.pages).toEqual([{ items: ['first'], nextCursor: CURSOR }])
  })
})
