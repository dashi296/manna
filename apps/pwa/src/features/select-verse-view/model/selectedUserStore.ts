import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
