// SSR では Start コンテキストのリクエストヘッダから、CSR では document.cookie から読む
export async function getCookieHeader(): Promise<string> {
  if (typeof document !== 'undefined') return document.cookie
  const { getStartContext } = await import('@tanstack/start-storage-context')
  return getStartContext()?.request?.headers.get('cookie') ?? ''
}
