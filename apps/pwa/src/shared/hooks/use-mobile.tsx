import { useSyncExternalStore } from 'react'

// サイドバー（lg:）と BottomNav（lg:hidden）の表示境界に合わせる
const MOBILE_BREAKPOINT = 1024

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

// mql.matches ではなく innerWidth を見る。境界の解釈をサイドバー側と一致させる
const getSnapshot = () => window.innerWidth < MOBILE_BREAKPOINT

// サーバーには幅が無い。lg: のサイドバー側に倒しておく
const getServerSnapshot = () => false

/**
 * effect ではなく外部ストアとして購読する。effect で読むと初回描画が必ず
 * デスクトップ扱いになり、ハイドレーション後にマウントされる要素まで
 * 1 フレーム間違った配置で DOM に入る
 */
export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
