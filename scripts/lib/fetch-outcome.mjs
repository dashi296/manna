// 取り込みの「何を失敗とみなすか」と終了コードの決め方。スクリプト本体は通信と DB を
// 伴うため、この判断だけを切り出してテストできるようにする
export function createOutcome() {
  let failed = 0
  return {
    // 通信・解析・DB 操作で例外になった章
    recordError() {
      failed += 1
    },
    // 見出しが取れなかった章。取得元のマークアップが変わると全章でここに落ちる。
    // 警告だけで成功終了すると、見出しが空のまま本番へ進める。
    // 前付け文書にはそもそも章のタイトルが無いので対象外
    recordHeading({ isFrontMatter, heading }) {
      if (isFrontMatter) return false
      if (heading) return false
      failed += 1
      return true
    },
    get failed() {
      return failed
    },
    get exitCode() {
      return failed > 0 ? 1 : 0
    },
  }
}
