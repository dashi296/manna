// 送信中の表示を確かめるために、解決タイミングをテスト側で握る Promise。
export function deferred<T = unknown>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve: (value: T) => resolve(value) }
}
