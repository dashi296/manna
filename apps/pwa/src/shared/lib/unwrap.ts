import type { PostgrestError } from '@supabase/supabase-js'

// Supabase はクエリ失敗時も reject せず { data: null, error } を返すため、
// error を見ないと障害が「0件」として表示されてしまう。
//
// 行が0件でも error になる .single() には使わないこと。存在しない行を 404 にしている
// 呼び出し側（posts/$id、プロフィール行）で 500 に化ける。
export function unwrap<T>(
  res: { data: T; error: null } | { data: null; error: PostgrestError },
): T {
  if (res.error) throw res.error
  return res.data
}
