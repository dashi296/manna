// secure context でないと navigator.clipboard 自体が生えない。
// 呼び出し側は結果で通知を出し分けるので、ここでは例外を外に出さない
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
