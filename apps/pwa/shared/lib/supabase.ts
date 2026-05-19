import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@manna/database'

// createBrowserClient はセッションを cookie に保存するため
// SSR 時に getRequest().headers から読み取れる
export const supabase = createBrowserClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
