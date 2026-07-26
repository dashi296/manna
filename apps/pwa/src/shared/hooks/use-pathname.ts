import { useRouterState } from '@tanstack/react-router'

// 素の useRouterState() は状態オブジェクト全体を購読するため、pending/idle の遷移でも
// 再レンダーされる。パスだけを見るなら必ずこちらを使うこと
export function usePathname() {
  return useRouterState({ select: (s) => s.location.pathname })
}
