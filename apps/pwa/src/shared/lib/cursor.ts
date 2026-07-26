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
