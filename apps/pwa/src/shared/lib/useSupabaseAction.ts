import { useState } from 'react'

export function useSupabaseAction() {
  const [pending, setPending] = useState(false)

  const run = async (action: () => PromiseLike<{ error: unknown }>, onSuccess: () => void) => {
    if (pending) return
    setPending(true)
    const { error } = await action()
    if (!error) onSuccess()
    setPending(false)
  }

  return { pending, run }
}
