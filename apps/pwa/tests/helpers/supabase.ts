// Supabase の PostgrestFilterBuilder を模した最小のチェーン可能モック。
// select/eq/in/order/abortSignal は自身を返し続け、await（.then）した時点で
// getResponse() の結果を解決する。呼び出しごとに異なる応答を返したい場合は
// getResponse 内で可変の状態を参照すればよい。
export function createSupabaseQueryChain(
  getResponse: () => { data: unknown; error?: unknown },
) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    order: () => chain,
    abortSignal: () => chain,
    then: (resolve: (result: { data: unknown; error?: unknown }) => void) =>
      resolve(getResponse()),
  }
  return chain
}
