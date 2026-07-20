import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useMounted } from '@/shared/hooks/use-mounted'

export const SELECTED_USER_STORAGE_KEY = 'manna:selectedUser:v1'

type State = {
  selectedUserId: string | null
  select: (userId: string) => void
  clear: () => void
}

export const useSelectedUserStore = create<State>()(
  persist(
    (set) => ({
      selectedUserId: null,
      select: (userId) => set({ selectedUserId: userId }),
      clear: () => set({ selectedUserId: null }),
    }),
    { name: SELECTED_USER_STORAGE_KEY },
  ),
)

// SSR-safe reader for the persisted selection.
// TanStack Start renders on the server with selectedUserId=null while the
// browser's zustand persist middleware synchronously restores from localStorage
// before the first client render. Gating the read on `useMounted` makes SSR
// and the first client render agree (both null); after mount the effect flips
// mounted=true and the real persisted value takes over.
export function useSelectedUserId(): string | null {
  const stored = useSelectedUserStore((s) => s.selectedUserId)
  const mounted = useMounted()
  return mounted ? stored : null
}
