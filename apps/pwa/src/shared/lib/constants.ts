export const ANONYMOUS_DISPLAY_NAME = '匿名ユーザー'

export function resolveUserIdentity(user: { display_name: string | null; avatar_url: string | null } | null) {
  return {
    displayName: user?.display_name ?? ANONYMOUS_DISPLAY_NAME,
    avatarUrl: user?.avatar_url ?? null,
  }
}
