import { Button } from '@/shared/ui/button'
import { useToggleFollow } from '../model/useToggleFollow'

type Props = {
  targetUserId: string
  currentUserId: string
  // invalidateRelationQueries が落とせるクエリ由来の値を渡すこと
  isFollowing: boolean
}

export function FollowButton({ targetUserId, currentUserId, isFollowing }: Props) {
  const { mutate, isPending, shown: following } = useToggleFollow({
    currentUserId,
    targetUserId,
    isFollowing,
  })

  return (
    <Button
      onClick={() => mutate(!following)}
      disabled={isPending}
      variant={following ? 'outline' : 'default'}
      size="sm"
    >
      {following ? 'フォロー中' : 'フォロー'}
    </Button>
  )
}
