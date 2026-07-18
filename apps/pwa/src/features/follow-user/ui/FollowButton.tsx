import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { supabase } from '@/shared/lib/supabase'
import { useSupabaseAction } from '@/shared/lib/useSupabaseAction'

type Props = {
  targetUserId: string
  currentUserId: string
  initialFollowing: boolean
}

export function FollowButton({ targetUserId, currentUserId, initialFollowing }: Props) {
  const [following, setFollowing] = useState(initialFollowing)
  const { pending, run } = useSupabaseAction()

  const toggle = () => run(
    () => following
      ? supabase.from('follows').delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', targetUserId)
      : supabase.from('follows').insert({
          follower_id: currentUserId,
          following_id: targetUserId,
        }),
    () => setFollowing(!following),
  )

  return (
    <Button
      onClick={toggle}
      disabled={pending}
      variant={following ? 'outline' : 'default'}
      size="sm"
    >
      {following ? 'フォロー中' : 'フォロー'}
    </Button>
  )
}
