import { render } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '@/shared/lib/queryClient'

// 要素を毎回作り直す。同じ参照を rerender に渡すと React が再レンダーを省き、
// モックの戻り値を差し替えても反映されない
export function renderWithQueryClient(ui: () => React.ReactElement) {
  // キャッシュがテスト間で漏れないよう、毎回新しい QueryClient を使う
  const client = createQueryClient()
  const wrap = () => <QueryClientProvider client={client}>{ui()}</QueryClientProvider>
  const utils = render(wrap())
  return { ...utils, client, rerenderWithQueryClient: () => utils.rerender(wrap()) }
}
