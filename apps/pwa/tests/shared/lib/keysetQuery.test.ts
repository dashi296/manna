import { describe, it, expect, vi, afterEach } from 'vitest'
import { QueryClient, InfiniteQueryObserver, onlineManager } from '@tanstack/react-query'
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
  onlineManager.setOnline(true)
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

  // 無効化やフォーカスで走る全ページの取り直しは fetchMore を持たないが、pages 1 が効かず
  // 遷移が全ページの完了待ちになる点は「もっと見る」と同じ
  it('複数ページの取り直しが飛んでいる最中に戻ってきたら、それを打ち切って1ページ目だけを返す', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { queryClient, fetchPage, options } = setup()
    await loadFirstPage(queryClient, options)
    const observer = new InfiniteQueryObserver(queryClient, options)
    const unsubscribe = observer.subscribe(() => {})
    await observer.fetchNextPage()
    expect(observer.getCurrentResult().data?.pages).toHaveLength(2)
    vi.setSystemTime(Date.now() + 11 * 1000)

    const pending = deferred<Page>()
    fetchPage.mockImplementationOnce(() => pending.promise)
    void queryClient.refetchQueries({ queryKey: options.queryKey })
    await vi.waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(3))

    // pending は解決しないまま。打ち切らなければここで止まる
    const data = await loadFirstPage(queryClient, options)
    unsubscribe()

    expect(fetchPage).toHaveBeenCalledTimes(4)
    expect(data.pages).toEqual([{ items: ['first'], nextCursor: CURSOR }])
  })

  // オフラインで止まった取得も fetchStatus が 'paused' のまま Promise を使い回される
  it('「もっと見る」がオフラインで止まっている最中に戻ってきても、それを待たない', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { queryClient, fetchPage, options } = setup()
    await loadFirstPage(queryClient, options)
    vi.setSystemTime(Date.now() + 11 * 1000)

    onlineManager.setOnline(false)
    const observer = new InfiniteQueryObserver(queryClient, options)
    const unsubscribe = observer.subscribe(() => {})
    void observer.fetchNextPage()
    await vi.waitFor(() =>
      expect(queryClient.getQueryState(options.queryKey)?.fetchStatus).toBe('paused'),
    )

    const loading = loadFirstPage(queryClient, options)
    onlineManager.setOnline(true)
    // 止まっていた「もっと見る」に相乗りすると、復帰後にその続きが走って2ページ目まで持ち込む
    const data = await loading
    unsubscribe()

    expect(fetchPage).toHaveBeenLastCalledWith(null)
    expect(data.pages).toEqual([{ items: ['first'], nextCursor: CURSOR }])
  })

  // キャッシュに「もっと見る」済みの古いページが残っていても、飛んでいるのが先読みなら相乗りする
  it('複数ページを持つ古いキャッシュでも、先読みが飛んでいる最中のクリックはそれを使い回す', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { queryClient, fetchPage, options } = setup()
    await loadFirstPage(queryClient, options)
    const observer = new InfiniteQueryObserver(queryClient, options)
    const unsubscribe = observer.subscribe(() => {})
    await observer.fetchNextPage()
    unsubscribe()
    vi.setSystemTime(Date.now() + 11 * 1000)

    const pending = deferred<Page>()
    fetchPage.mockImplementationOnce(() => pending.promise)
    const preload = loadFirstPage(queryClient, options)
    await vi.waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(3))
    const enter = loadFirstPage(queryClient, options)
    pending.resolve({ items: ['first'], nextCursor: CURSOR })

    const firstPageOnly = { pages: [{ items: ['first'], nextCursor: CURSOR }] }
    await expect(preload).resolves.toMatchObject(firstPageOnly)
    await expect(enter).resolves.toMatchObject(firstPageOnly)
    expect(fetchPage).toHaveBeenCalledTimes(3)
  })

  // フォロー操作の invalidateRelationQueries が先読みの取得中に来ると、query-core は
  // 取得の成功時に isInvalidated を下ろすので、変更前の一覧が新しい扱いで残る
  it('先読みの取得中に無効化されたら、変更前の結果を返さずに取り直す', async () => {
    const { queryClient, fetchPage, options } = setup()
    const pending = deferred<Page>()
    fetchPage.mockImplementationOnce(() => pending.promise)
    fetchPage.mockImplementationOnce(async () => ({ items: ['after'], nextCursor: null }))

    const preload = loadFirstPage(queryClient, options)
    await vi.waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1))
    await queryClient.invalidateQueries({ queryKey: options.queryKey })
    const enter = loadFirstPage(queryClient, options)
    pending.resolve({ items: ['before'], nextCursor: null })

    const afterOnly = { pages: [{ items: ['after'] }] }
    await expect(preload).resolves.toMatchObject(afterOnly)
    await expect(enter).resolves.toMatchObject(afterOnly)
    expect(queryClient.getQueryState(options.queryKey)?.isInvalidated).toBe(false)
  })

  // 購読者がいてもデータがまだ無いと、query-core は飛んでいる取得を打ち切らずに使い回す
  it('購読者がいてデータが無いときに無効化されても、変更前の結果を残さない', async () => {
    const { queryClient, fetchPage, options } = setup()
    const pending = deferred<Page>()
    fetchPage.mockImplementationOnce(() => pending.promise)
    fetchPage.mockImplementationOnce(async () => ({ items: ['after'], nextCursor: null }))

    const preload = loadFirstPage(queryClient, options)
    await vi.waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1))
    const observer = new InfiniteQueryObserver(queryClient, options)
    const unsubscribe = observer.subscribe(() => {})
    // 購読者がいると無効化は飛んでいる取得の完了を待つので、ここでは待たない
    const invalidating = queryClient.invalidateQueries({ queryKey: options.queryKey })
    pending.resolve({ items: ['before'], nextCursor: null })
    await invalidating

    await expect(preload).resolves.toMatchObject({ pages: [{ items: ['after'] }] })
    unsubscribe()
    expect(queryClient.getQueryData(options.queryKey)).toMatchObject({
      pages: [{ items: ['after'] }],
    })
  })
})
