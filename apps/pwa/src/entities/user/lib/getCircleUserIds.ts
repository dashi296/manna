import type { createSupabaseServer } from '@/shared/lib/auth'

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServer>>

export type CircleUserRow = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

export async function getCircleUserIds(
  supabase: SupabaseServer,
  userId: string,
): Promise<{ ids: string[]; users: CircleUserRow[] }> {
  const [{ data: follows }, { data: family }] = await Promise.all([
    supabase.from('follows').select('following_id').eq('follower_id', userId).throwOnError(),
    supabase
      .from('family_relationships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .throwOnError(),
  ])

  const ids = new Set<string>([userId])
  follows.forEach((f) => ids.add(f.following_id))
  family.forEach((r) => ids.add(r.requester_id === userId ? r.addressee_id : r.requester_id))
  const idList = [...ids]

  const { data: users } = await supabase
    .from('users')
    .select('id, display_name, avatar_url')
    .in('id', idList)
    .throwOnError()

  return { ids: idList, users }
}
