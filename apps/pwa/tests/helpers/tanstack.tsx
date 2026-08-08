import { vi } from 'vitest'

// createFileRoute('/path')(config) は「呼び出し可能を返す関数」なので、
// プレーンオブジェクトを返すスタブだとページモジュールの評価時にクラッシュする。
export function routerMock(
  useLoaderData: () => unknown = () => ({}),
  getPathname: () => string = () => '/',
  navigate: (opts: unknown) => void = () => {},
  // loader ではなく params/search からデータを組み立てるページ用。渡さなければ空を返す
  routeHooks: { useParams?: () => unknown; useSearch?: () => unknown } = {},
  // 削除フローのように router.invalidate() / history.back() を叩くコンポーネント用
  router: {
    invalidate?: (opts?: { filter?: (match: { routeId: string }) => boolean }) => void
    canGoBack?: () => boolean
    back?: () => void
    // invalidate の filter が「今いるルート」を除外できているか検証するための現在地
    routeId?: string
  } = {},
) {
  return {
    createFileRoute: () => (config: Record<string, unknown>) => ({
      ...config,
      useLoaderData,
      useParams: routeHooks.useParams ?? (() => ({})),
      useSearch: routeHooks.useSearch ?? (() => ({})),
    }),
    Link: ({
      to,
      params,
      search,
      children,
      ...props
    }: {
      to?: string
      params?: Record<string, string>
      search?: Record<string, unknown>
      children?: React.ReactNode
      [key: string]: unknown
    }) => {
      const path = to && params
        ? Object.entries(params).reduce((acc, [k, v]) => acc.replace(`$${k}`, v), to)
        : to
      // 空オブジェクトの search={{}}（PageHeader の戻るリンクなど）で href に
      // 余計な "?" が付かないよう、キーがある場合のみクエリ文字列を付与する。
      // 本番の TanStack Router は配列値を JSON化する（?verses=%5B19%5D）が、
      // ここは String() で結合するため配列は "?verses=19" のようになる。
      const searchEntries = search ? Object.entries(search) : []
      const query = searchEntries.length > 0
        ? `?${new URLSearchParams(searchEntries.map(([k, v]) => [k, String(v)]))}`
        : ''
      const href = path ? `${path}${query}` : path
      return (
        <a href={href} {...props}>
          {children}
        </a>
      )
    },
    notFound: () => new Error('not found'),
    redirect: (opts: { to: string; params?: Record<string, string> }) => opts,
    useRouterState: (opts?: { select?: (state: unknown) => unknown }) => {
      const state = { location: { pathname: getPathname() } }
      return opts?.select ? opts.select(state) : state
    },
    useNavigate: () => navigate,
    useRouter: () => ({
      invalidate: router.invalidate ?? (() => {}),
      state: { matches: [{ routeId: router.routeId ?? '/' }] },
      history: {
        canGoBack: router.canGoBack ?? (() => true),
        back: router.back ?? (() => {}),
      },
    }),
  }
}

export const routeComponent = (mod: { Route: unknown }) =>
  (mod.Route as { component: React.ComponentType }).component

// routerMock の createFileRoute は config をそのまま展開して返すため、loader も生えている。
// 本物の Route 型には現れないのでキャストが要る（routeComponent と同じ事情）
export const routeLoader = (mod: { Route: unknown }) =>
  (mod.Route as {
    loader: (ctx: {
      params: Record<string, string>
      deps: Record<string, unknown>
      context: Record<string, unknown>
    }) => Promise<unknown>
  }).loader

// getServerSession (@/shared/lib/auth) は .inputValidator() を挟まず
// .handler() を直接呼ぶため、両方のチェーンをスタブする必要がある。
// 対象モジュール内の createServerFn 呼び出しは全て同じ impl に束縛されるため、
// 1モジュールに2つ以上の createServerFn がある場合はこのスタブでは区別できない。
export function startMock(impl?: (...args: never[]) => unknown) {
  const handler = () => impl ?? vi.fn()
  return {
    createServerFn: () => ({
      handler,
      inputValidator: () => ({ handler }),
    }),
  }
}
