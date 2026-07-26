import { Button } from '@/shared/ui/button'
import { useToggleFollow } from '../model/useToggleFollow'

type Props = {
  targetUserId: string
  currentUserId: string
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
      onClick={() => mutate(!isFollowing)}
      disabled={isPending}
      variant={following ? 'outline' : 'default'}
      size="sm"
    >
      {following ? 'フォロー中' : 'フォロー'}
    </Button>
  )
}
