// keyset pagination のカーソル。並び順が (created_at DESC, 同点を割る id DESC) の一覧で
// 「どこまで読んだか」を表す。created_at だけを持つと同時刻の行をまとめて飛ばすため、
// 同点を割る id を必ず組にする。
export type Cursor = { createdAt: string; id: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// PostgREST が返す timestamptz。小数秒は桁数可変、末尾は 'Z' かオフセット。
const ISO_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

// カーソルはクライアントから送られてくるうえ、supabase-js の .or() が生文字列しか
// 受け取らない都合でフィルタ式に補間される。PostgREST は '.' と ',' を区切りに使うため、
// 値にこれらや '"' が混ざると条件式を書き換えられる。
//
// 特定のページの都合ではなくデータアクセス層の制約なので、使う場所の隣ではなくここに置く。
// 同種の補間は entities/family と entities/user にもある（#71 を参照）。
//
// 検証に Date.parse は使えない。'Jan 1, 2026' のような非 ISO 形式を通すため、カンマが
// 残ったまま補間される。toISOString での正規化も使えない。JS の Date はミリ秒精度しかなく、
// timestamptz のマイクロ秒が落ちて keyset 条件が一致しなくなる。
export function isValidCursor(cursor: Cursor): boolean {
  return UUID_RE.test(cursor.id) && ISO_TS_RE.test(cursor.createdAt)
}

export const PAGE_SIZE = 20

type OrderedQuery<Q> = {
  order: (column: string, options: { ascending: boolean }) => Q
  limit: (count: number) => Q
  or: (filters: string) => Q
}

// (created_at, idColumn) DESC の並びで「カーソルより古い行」を PAGE_SIZE + 1 件取る。
// +1 件は次ページの有無を見るためで、takePage が切り落とす。
//
// or() の値は上の isValidCursor を通っている前提。PostgREST は '.' と ',' を区切りに
// 使うため、小数秒を含む timestamptz はダブルクォートで囲む。
export function withKeyset<Q extends OrderedQuery<Q>>(
  query: Q,
  cursor: Cursor | null,
  idColumn = 'id',
): Q {
  const ordered = query
    .order('created_at', { ascending: false })
    .order(idColumn, { ascending: false })
    .limit(PAGE_SIZE + 1)

  if (!cursor) return ordered
  return ordered.or(
    `created_at.lt."${cursor.createdAt}",` +
      `and(created_at.eq."${cursor.createdAt}",${idColumn}.lt."${cursor.id}")`,
  )
}

// withKeyset が余分に取った1件を落とし、次ページのカーソルを組み立てる
export function takePage<T extends { created_at: string }>(
  rows: T[],
  idOf: (row: T) => string,
): { rows: T[]; nextCursor: Cursor | null } {
  const hasMore = rows.length > PAGE_SIZE
  const page = rows.slice(0, PAGE_SIZE)
  const last = page[page.length - 1]
  return {
    rows: page,
    nextCursor: hasMore ? { createdAt: last.created_at, id: idOf(last) } : null,
  }
}
