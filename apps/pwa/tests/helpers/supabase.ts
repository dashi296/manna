type Result = { data?: unknown; error?: unknown }

// Supabase の PostgrestFilterBuilder を模した最小のチェーン可能モック。
// select/eq/in/or/order/abortSignal/throwOnError は自身を返し続け、await（.then）した時点で
// getResponse() の結果を解決する。呼び出しごとに異なる応答を返したい場合は
// getResponse 内で可変の状態を参照すればよい。
// throwOnError を呼んでいて error があるときは、本物と同じく reject する。
// 絞り込みの引数を検証したい場合は record にスパイを渡す（eq/in/or が呼ばれるたびに通る）。
// select を繋ぐまで data を返さない（付け忘れ検知のため）。rpc は select 無しで返すので流用不可。
export function createSupabaseQueryChain(
  getResponse: () => Result,
  record: (column: string, value: unknown) => void = () => {},
) {
  let shouldThrow = false
  let selected = false
  const filter = (column: string, value: unknown) => {
    record(column, value)
    return chain
  }
  const chain = {
    select: () => {
      selected = true
      return chain
    },
    eq: filter,
    in: filter,
    or: (filterString: string) => filter('or', filterString),
    order: () => chain,
    abortSignal: () => chain,
    // maybeSingle は配列ではなく1行（無ければ null）を返す
    maybeSingle: () => {
      const raw = getResponse()
      const rows = (selected ? raw.data : null) as unknown[] | null | undefined
      return Promise.resolve({ data: rows?.[0] ?? null, error: raw.error ?? null })
    },
    throwOnError: () => {
      shouldThrow = true
      return chain
    },
    // Supabase のビルダーは thenable。それを模すので then は必須
    // oxlint-disable-next-line unicorn/no-thenable
    then: (...args: Parameters<Promise<Result>['then']>) => {
      const raw = getResponse()
      const res = selected ? raw : { ...raw, data: null }
      const settled = shouldThrow && res.error ? Promise.reject(res.error) : Promise.resolve(res)
      return settled.then(...args)
    },
  }
  return chain
}
