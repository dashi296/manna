import { Button } from '@/shared/ui/button'
import { useToggleFollow } from '../model/useToggleFollow'

type Props = {
  targetUserId: string
  currentUserId: string
  isFollowing: boolean
}

export function FollowButton({ targetUserId, currentUserId, isFollowing }: Props) {
  const { mutate, isPending, variables } = useToggleFollow(currentUserId, targetUserId)

  // 送信中は押した結果を先に見せる。確定後は無効化された prop 側が正になる
  const following = isPending && variables !== undefined ? variables : isFollowing

  return (
    <Button
      onClick={() => mutate(!isFollowing)}
      disabled={isPending}
      variant={following ? 'outline' : 'default'}
      size="sm"
    >
      {following ? 'フォロー中' : 'フォロー'}
    </Button>
  )
}
