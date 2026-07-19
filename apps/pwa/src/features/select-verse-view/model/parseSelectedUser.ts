const USER_ID_RE = /^[0-9a-f-]{8,36}$/i

export function parseSelectedUser(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined
  return USER_ID_RE.test(input) ? input : undefined
}
