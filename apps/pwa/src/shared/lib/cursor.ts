// keyset pagination のカーソル。並び順が (created_at DESC, 同点を割る id DESC) の一覧で
// 「どこまで読んだか」を表す。created_at だけを持つと同時刻の行をまとめて飛ばすため、
// 同点を割る id を必ず組にする。
export type Cursor = { createdAt: string; id: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// PostgREST が返す timestamptz。小数秒は桁数可変、末尾は 'Z' かオフセット。
const ISO_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

// カーソルはクライアントから送られてくる。RPC のパラメータとして渡すので値そのものが
// フィルタ式に補間されることはもう無いが（#92 で .or() 文字列補間から行比較 RPC に移行）、
// 壊れた値をそのまま SQL 関数に渡さないための入力チェックとして残す。
//
// 特定のページの都合ではなくデータアクセス層の制約なので、使う場所の隣ではなくここに置く。
// 同種の補間は entities/family と entities/user にもある（#71 を参照）。
//
// 検証に Date.parse は使えない。'Jan 1, 2026' のような非 ISO 形式を通してしまう。
// toISOString での正規化も使えない。JS の Date はミリ秒精度しかなく、timestamptz の
// マイクロ秒が落ちて keyset 条件が一致しなくなる。
export function isValidCursor(cursor: Cursor): boolean {
  return UUID_RE.test(cursor.id) && ISO_TS_RE.test(cursor.createdAt)
}

// RPC 呼び出し側は必ずこれを page_size として渡す（SQL 側のデフォルトに頼らない）。
// +1 件は次ページの有無を見るためで、takePage が切り落とす。
export const PAGE_SIZE = 20

// RPC が余分に取った1件を落とし、次ページのカーソルを組み立てる。
// idColumn は RPC 呼び出し側の同点カーソル列と必ず同じにすること（別の列だと行が飛ぶ）
export function takePage<T extends { created_at: string }>(
  rows: T[],
  idColumn = 'id',
): { rows: T[]; nextCursor: Cursor | null } {
  const hasMore = rows.length > PAGE_SIZE
  const page = rows.slice(0, PAGE_SIZE)
  const last = page[page.length - 1] as T & Record<string, string>
  return {
    rows: page,
    nextCursor: hasMore ? { createdAt: last.created_at, id: last[idColumn] } : null,
  }
}
