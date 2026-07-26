import { type FamilyStatus } from '@/entities/family'
import { Button } from '@/shared/ui/button'
import { NEXT_STATUS, useFamilyAction } from '../model/useFamilyAction'

type Props = {
  targetUserId: string
  currentUserId: string
  status: FamilyStatus
}

export function FamilyButton({ targetUserId, currentUserId, status }: Props) {
  const { mutate, isPending, variables } = useFamilyAction(currentUserId, targetUserId)

  // 送信中は押した結果を先に見せる。確定後は無効化された prop 側が正になる
  const shown = isPending && variables !== undefined ? NEXT_STATUS[variables] : status

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
