export function formatDate(iso: string, opts?: { year?: boolean }): string {
  return new Date(iso).toLocaleDateString('ja-JP', {
    ...(opts?.year && { year: 'numeric' as const }),
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Tokyo',
  })
}
