import { supabase } from '@/shared/lib/supabase'
import { useRelationMutation } from '@/shared/lib/useRelationMutation'

type Args = { currentUserId: string; targetUserId: string; isFollowing: boolean }

export function useToggleFollow({ currentUserId, targetUserId, isFollowing }: Args) {
  return useRelationMutation<boolean, boolean>({
    current: isFollowing,
    optimistic: (next) => next,
    run: (next) =>
      next
        ? supabase.from('follows').insert({
            follower_id: currentUserId,
            following_id: targetUserId,
          })
        : supabase.from('follows').delete()
            .eq('follower_id', currentUserId)
            .eq('following_id', targetUserId),
    errorMessage: () => 'フォローを更新できませんでした',
  })
}
