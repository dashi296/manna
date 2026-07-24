import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useMounted } from '@/shared/hooks/use-mounted'

export const BILINGUAL_DISPLAY_STORAGE_KEY = 'manna:bilingual-display:v1'

type State = {
  enabled: boolean
  toggle: () => void
}

export const useBilingualDisplayStore = create<State>()(
  persist(
    (set, get) => ({
      enabled: false,
      toggle: () => set({ enabled: !get().enabled }),
    }),
    { name: BILINGUAL_DISPLAY_STORAGE_KEY },
  ),
)

// SSR-safe reader: SSR と初回クライアントレンダーは persist 未反映の初期値 (false) で
// 一致させ、mount 後に永続化された値へ切り替える（useIsBookmarked と同じパターン）。
export function useBilingualEnabled(): boolean {
  const enabled = useBilingualDisplayStore((s) => s.enabled)
  const mounted = useMounted()
  return mounted ? enabled : false
}
