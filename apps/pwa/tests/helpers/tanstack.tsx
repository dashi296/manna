import { vi } from 'vitest'

// createFileRoute('/path')(config) は「呼び出し可能を返す関数」なので、
// プレーンオブジェクトを返すスタブだとページモジュールの評価時にクラッシュする。
export function routerMock(
  useLoaderData: () => unknown = () => ({}),
  getPathname: () => string = () => '/',
) {
  return {
    createFileRoute: () => (config: Record<string, unknown>) => ({
      ...config,
      useLoaderData,
    }),
    Link: ({ to, params, children, ...props }: { to?: string; params?: Record<string, string>; children?: React.ReactNode; [key: string]: unknown }) => {
      const href = to && params
        ? Object.entries(params).reduce((acc, [k, v]) => acc.replace(`$${k}`, v), to)
        : to
      return (
        <a href={href} {...props}>
          {children}
        </a>
      )
    },
    notFound: () => new Error('not found'),
    useRouterState: () => ({ location: { pathname: getPathname() } }),
  }
}

export const routeComponent = (mod: { Route: unknown }) =>
  (mod.Route as { component: React.ComponentType }).component

// getServerSession (@/shared/lib/auth) は .inputValidator() を挟まず
// .handler() を直接呼ぶため、両方のチェーンをスタブする必要がある。
export function startMock() {
  return {
    createServerFn: () => ({
      handler: () => vi.fn(),
      inputValidator: () => ({
        handler: () => vi.fn(),
      }),
    }),
  }
}
