import { createClient } from '@supabase/supabase-js'
import type { Database } from '@manna/database'

// Node.js < 22 には native WebSocket がないため SSR で ws を使う
const wsImpl =
  typeof globalThis.WebSocket !== 'undefined'
    ? globalThis.WebSocket
    : ((await import('ws')).WebSocket as unknown as typeof WebSocket)

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { realtime: { transport: wsImpl } },
)
