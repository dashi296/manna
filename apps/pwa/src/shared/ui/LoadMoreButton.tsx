import type { UseInfiniteQueryResult } from '@tanstack/react-query'
import { Button } from '@/shared/ui/button'

// 表示条件まで持つ。呼び出し側に置くと hasNextPage の書き忘れや、
// isFetchingNextPage ではなく isFetching を渡す取り違えが起きる。
// fetchNextPage を包むのは、クリックイベントがページ引数として渡らないようにするため
type Props = {
  query: Pick<
    UseInfiniteQueryResult<unknown>,
    'hasNextPage' | 'fetchNextPage' | 'isFetchingNextPage'
  >
}

export function LoadMoreButton({ query }: Props) {
  if (!query.hasNextPage) return null

  return (
    <div className="p-4 text-center">
      <Button
        onClick={() => query.fetchNextPage()}
        disabled={query.isFetchingNextPage}
        variant="outline"
        size="sm"
      >
        もっと見る
      </Button>
    </div>
  )
}
