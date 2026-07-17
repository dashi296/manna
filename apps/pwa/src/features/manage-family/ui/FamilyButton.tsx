import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { familyPairFilter } from '@/shared/lib/familyQuery'
import { supabase } from '@/shared/lib/supabase'

export type FamilyStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted'

type Props = {
  targetUserId: string
  currentUserId: string
  initialStatus: FamilyStatus
}

export function FamilyButton({ targetUserId, currentUserId, initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus)
  const [pending, setPending] = useState(false)

  const run = async (action: () => PromiseLike<{ error: unknown }>, next: FamilyStatus) => {
    setPending(true)
    const { error } = await action()
    if (!error) setStatus(next)
    setPending(false)
  }

  const sendRequest = () => run(
    () => supabase.from('family_relationships').insert({ requester_id: currentUserId, addressee_id: targetUserId }),
    'pending_sent',
  )

  const accept = () => run(
    () => supabase.from('family_relationships').update({ status: 'accepted' }).eq('requester_id', targetUserId).eq('addressee_id', currentUserId),
    'accepted',
  )

  const remove = () => run(
    () => supabase.from('family_relationships').delete().or(familyPairFilter(currentUserId, targetUserId)),
    'none',
  )

  if (status === 'accepted') {
    return (
      <Button onClick={remove} disabled={pending} variant="outline" size="sm">
        ファミリー
      </Button>
    )
  }

  if (status === 'pending_sent') {
    return (
      <Button disabled variant="outline" size="sm">
        招待送信済み
      </Button>
    )
  }

  if (status === 'pending_received') {
    return (
      <Button onClick={accept} disabled={pending} size="sm">
        招待を承認
      </Button>
    )
  }

  return (
    <Button onClick={sendRequest} disabled={pending} variant="outline" size="sm">
      ファミリーに追加
    </Button>
  )
}
