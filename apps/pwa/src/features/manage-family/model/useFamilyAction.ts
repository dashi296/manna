import { filterFamilyPair, type FamilyStatus } from '@/entities/family'
import { supabase } from '@/shared/lib/supabase'
import { useRelationMutation } from '@/entities/user'

export type FamilyAction = 'request' | 'accept' | 'remove'

const NEXT_STATUS: Record<FamilyAction, FamilyStatus> = {
  request: 'pending_sent',
  accept: 'accepted',
  remove: 'none',
}

const ERROR_MESSAGE: Record<FamilyAction, string> = {
  request: 'ファミリーに追加できませんでした',
  accept: '招待を承認できませんでした',
  remove: 'ファミリーから外せませんでした',
}

type Args = { currentUserId: string; targetUserId: string; status: FamilyStatus }

export function useFamilyAction({ currentUserId, targetUserId, status }: Args) {
  return useRelationMutation<FamilyAction, FamilyStatus>({
    current: status,
    optimistic: (action) => NEXT_STATUS[action],
    run: (action) => runAction(action, currentUserId, targetUserId),
    errorMessage: (action) => ERROR_MESSAGE[action],
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
