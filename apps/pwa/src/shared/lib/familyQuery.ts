export function familyPairFilter(userA: string, userB: string): string {
  return (
    `and(requester_id.eq.${userA},addressee_id.eq.${userB}),` +
    `and(requester_id.eq.${userB},addressee_id.eq.${userA})`
  )
}
