export type FamilyStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted'

export function resolveFamilyStatus(
  row: { status: string; requester_id: string } | null | undefined,
  currentUserId: string,
): FamilyStatus {
  if (!row) return 'none'
  if (row.status === 'accepted') return 'accepted'
  return row.requester_id === currentUserId ? 'pending_sent' : 'pending_received'
}

export function familyPairFilter(userA: string, userB: string): string {
  return (
    `and(requester_id.eq.${userA},addressee_id.eq.${userB}),` +
    `and(requester_id.eq.${userB},addressee_id.eq.${userA})`
  )
}
