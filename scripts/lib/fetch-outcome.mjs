// 取り込みの結果をどう終了コードに落とすか。スクリプト本体は通信と DB を伴うため、
// この判断だけを切り出してテストできるようにする
export function exitCodeFor({ failed }) {
  return failed > 0 ? 1 : 0
}
