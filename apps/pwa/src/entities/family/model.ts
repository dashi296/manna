export type FamilyStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted'

export function resolveFamilyStatus(
  row: { status: string; requester_id: string } | null | undefined,
  currentUserId: string,
): FamilyStatus {
  if (!row) return 'none'
  if (row.status === 'accepted') return 'accepted'
  return row.requester_id === currentUserId ? 'pending_sent' : 'pending_received'
}

// requester/addressee のどちらが誰でも拾う。requester_id <> addressee_id の CHECK が
// あるため、両列を同じ2人組に絞れば該当ペアの行だけが残る。
// id を .or() のフィルタ文字列に埋め込まないので、値に PostgREST の構文が混ざっても
// 式として解釈されない。
export function filterFamilyPair<T extends { in: (column: string, values: string[]) => T }>(
  query: T,
  userA: string,
  userB: string,
): T {
  const pair = [userA, userB]
  return query.in('requester_id', pair).in('addressee_id', pair)
}
