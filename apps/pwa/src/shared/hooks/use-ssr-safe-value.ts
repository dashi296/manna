import { useMounted } from '@/shared/hooks/use-mounted'

// SSR-safe reader: SSR と初回クライアントレンダーは persist 未反映の fallback で
// 一致させ、mount 後に永続化された value へ切り替える。zustand persist ストアの
// 値を SSR ミスマッチなく読むためのパターン。
export function useSSRSafe<T>(value: T, fallback: T): T {
  return useMounted() ? value : fallback
}
