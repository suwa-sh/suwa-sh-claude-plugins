import { useState } from 'react'

/**
 * 一覧の検索条件・ページをルーティングのクエリパラメータと同期する
 * （画面をまたぐ共有状態を持たない / arch LR-026）。
 * Storybook 環境では実ルーターを持たないため、画面ローカルの state で代替する。
 */
export function useListQueryState<T extends Record<string, unknown>>(initial: T) {
  const [state, setState] = useState<T>(initial)

  function update<K extends keyof T>(key: K, value: T[K]) {
    setState((prev) => {
      const next = { ...prev, [key]: value }
      if (key !== ('page' as K) && 'page' in next) {
        ;(next as Record<string, unknown>).page = 1
      }
      return next
    })
  }

  function reset() {
    setState(initial)
  }

  return { state, update, reset, setState }
}
