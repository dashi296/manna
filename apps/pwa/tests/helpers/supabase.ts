// Supabase の PostgrestFilterBuilder を模した最小のチェーン可能モック。
// select/eq/in/order/abortSignal は自身を返し続け、await（.then）した時点で
// getResponse() の結果を解決する。呼び出しごとに異なる応答を返したい場合は
// getResponse 内で可変の状態を参照すればよい。
// 絞り込みの引数を検証したい場合は record にスパイを渡す（eq/in が呼ばれるたびに通る）。
export function createSupabaseQueryChain(
  getResponse: () => { data?: unknown; error?: unknown },
  record: (column: string, value: unknown) => void = () => {},
) {
  const chain = {
    select: () => chain,
    eq: (column: string, value: unknown) => {
      record(column, value)
      return chain
    },
    in: (column: string, values: unknown) => {
      record(column, values)
      return chain
    },
    order: () => chain,
    abortSignal: () => chain,
    then: (resolve: (result: { data?: unknown; error?: unknown }) => void) =>
      resolve(getResponse()),
  }
  return chain
}
