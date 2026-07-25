export type Cursor = { createdAt: string; otherId: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// PostgREST が返す timestamptz。小数秒は桁数可変、末尾は 'Z' かオフセット。
const ISO_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

// カーソルは .or() の文字列に補間されるためフィルタインジェクションを防ぐ
export function isValidCursor(cursor: Cursor): boolean {
  return UUID_RE.test(cursor.otherId) && ISO_TS_RE.test(cursor.createdAt)
}
