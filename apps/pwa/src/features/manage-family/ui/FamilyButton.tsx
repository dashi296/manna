import { type FamilyStatus } from '@/entities/family'
import { Button } from '@/shared/ui/button'
import { useFamilyAction } from '../model/useFamilyAction'

type Props = {
  targetUserId: string
  currentUserId: string
  // invalidateRelationQueries が落とせるクエリ由来の値を渡すこと
  status: FamilyStatus
}

export function FamilyButton({ targetUserId, currentUserId, status }: Props) {
  const { mutate, isPending, shown } = useFamilyAction({ currentUserId, targetUserId, status })

  if (shown === 'accepted') {
    return (
      <Button onClick={() => mutate('remove')} disabled={isPending} variant="outline" size="sm">
        ファミリー
      </Button>
    )
  }

  if (shown === 'pending_sent') {
    return (
      <Button disabled variant="outline" size="sm">
        招待送信済み
      </Button>
    )
  }

  if (shown === 'pending_received') {
    return (
      <Button onClick={() => mutate('accept')} disabled={isPending} size="sm">
        招待を承認
      </Button>
    )
  }

  return (
    <Button onClick={() => mutate('request')} disabled={isPending} variant="outline" size="sm">
      ファミリーに追加
    </Button>
  )
}
