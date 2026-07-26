import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { filterFamilyPair, type FamilyStatus } from '@/entities/family'
import { supabase } from '@/shared/lib/supabase'
import { invalidateRelationQueries } from '@/shared/lib/invalidateRelationQueries'

export type FamilyAction = 'request' | 'accept' | 'remove'

export const NEXT_STATUS: Record<FamilyAction, FamilyStatus> = {
  request: 'pending_sent',
  accept: 'accepted',
  remove: 'none',
}

const ERROR_MESSAGE: Record<FamilyAction, string> = {
  request: 'ファミリーに追加できませんでした',
  accept: '招待を承認できませんでした',
  remove: 'ファミリーから外せませんでした',
}

export function useFamilyAction(currentUserId: string, targetUserId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (action: FamilyAction) => {
      const { error } = await runAction(action, currentUserId, targetUserId)
      // Supabase は失敗時も reject せず { error } を返すため、投げ直さないと成功扱いになる
      if (error) throw error
    },
    // Promise を返すと再取得の完了まで isPending が立ったままになり、楽観表示から
    // 実データへ切り替わる瞬間に表示が戻らない
    onSuccess: () => invalidateRelationQueries(queryClient),
    onError: (_error, action) => toast.error(ERROR_MESSAGE[action]),
  })
}

function runAction(action: FamilyAction, currentUserId: string, targetUserId: string) {
  const table = supabase.from('family_relationships')
  switch (action) {
    case 'request':
      return table.insert({ requester_id: currentUserId, addressee_id: targetUserId })
    case 'accept':
      // 招待を受けた側からの承認なので、相手が requester の行を更新する
      return table
        .update({ status: 'accepted' })
        .eq('requester_id', targetUserId)
        .eq('addressee_id', currentUserId)
    case 'remove':
      return filterFamilyPair(table.delete(), currentUserId, targetUserId)
  }
}
