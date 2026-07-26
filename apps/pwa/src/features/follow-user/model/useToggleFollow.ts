import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { invalidateRelationQueries } from '@/shared/lib/invalidateRelationQueries'

export function useToggleFollow(currentUserId: string, targetUserId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = next
        ? await supabase.from('follows').insert({
            follower_id: currentUserId,
            following_id: targetUserId,
          })
        : await supabase.from('follows').delete()
            .eq('follower_id', currentUserId)
            .eq('following_id', targetUserId)
      // Supabase は失敗時も reject せず { error } を返すため、投げ直さないと成功扱いになる
      if (error) throw error
    },
    // Promise を返すと再取得の完了まで isPending が立ったままになり、楽観表示から
    // 実データへ切り替わる瞬間にラベルが戻らない
    onSuccess: () => invalidateRelationQueries(queryClient),
    onError: () => toast.error('フォローを更新できませんでした'),
  })
}
