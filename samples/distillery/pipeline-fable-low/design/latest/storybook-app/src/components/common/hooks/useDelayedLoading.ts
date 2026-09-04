import { useEffect, useState } from 'react'

/**
 * loading が delayMs（既定 400ms、Doherty Threshold）継続したときだけ true を返す。
 * AsyncStateView 内部で Skeleton 表示の遅延に使う。応答が速い場合は Skeleton を出さない。
 */
export function useDelayedLoading(loading: boolean, delayMs = 400): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!loading) {
      // 次回 loading=true 時に新しい遅延計測を開始するためのリセット（デバウンス用途で意図的な同期更新）
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false)
      return
    }
    const timer = setTimeout(() => setVisible(true), delayMs)
    return () => clearTimeout(timer)
  }, [loading, delayMs])

  return loading && visible
}
