import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useSSRSafe } from '@/shared/hooks/use-ssr-safe-value'

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

export function useBilingualEnabled(): boolean {
  return useSSRSafe(useBilingualDisplayStore((s) => s.enabled), false)
}
