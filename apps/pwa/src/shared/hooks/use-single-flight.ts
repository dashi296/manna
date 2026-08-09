import { useRef, useState } from 'react'

type SingleFlight = {
  /** 送信中かどうか。ボタンの disabled や文言の出し分けに使う */
  pending: boolean
  /** 開始できたら true。false なら既に走っているので呼び出し側は何もしない */
  begin: () => boolean
  /** 失敗して再試行させたいときに呼ぶ。成功時は画面が変わるので通常は不要 */
  end: () => void
}

// 送信を1回に絞る。`pending` state や `disabled` は React の再レンダーまで
// 反映されないため、同じ tick に2発届くと両方とも「送信中でない」と判断してしまう
// （スマホの素早い二度押しで実際に起きる）。ref なら同期的に効く。
export function useSingleFlight(): SingleFlight {
  const running = useRef(false)
  const [pending, setPending] = useState(false)

  return {
    pending,
    begin: () => {
      if (running.current) return false
      running.current = true
      setPending(true)
      return true
    },
    end: () => {
      running.current = false
      setPending(false)
    },
  }
}
