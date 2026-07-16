import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { supabase } from '@/shared/lib/supabase'

type Props = {
  targetUserId: string
  currentUserId: string
  initialFollowing: boolean
}

export function FollowButton({ targetUserId, currentUserId, initialFollowing }: Props) {
  const [following, setFollowing] = useState(initialFollowing)
  const [pending, setPending] = useState(false)

  const toggle = async () => {
    if (pending) return
    setPending(true)
    if (following) {
      const { error } = await supabase.from('follows').delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId)
      if (!error) setFollowing(false)
    } else {
      const { error } = await supabase.from('follows').insert({
        follower_id: currentUserId,
        following_id: targetUserId,
      })
      if (!error) setFollowing(true)
    }
    setPending(false)
  }

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
