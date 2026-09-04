import { useCallback, useEffect, useState } from 'react'

export type UrlQueryValue = string | number | undefined

/**
 * URL クエリ ⇄ 画面内状態の双方向同期。
 * 一覧・分析画面の検索条件 / ページ番号を URL に保持し、編集・削除から戻ったときに復元する。
 * ブラウザ非依存（SSR / Storybook）では初期値をそのまま返す。
 */
export function useUrlQueryState<T extends Record<string, UrlQueryValue>>(defaults: T): [T, (patch: Partial<T>, options?: { replace?: boolean }) => void] {
  const readFromLocation = useCallback((): T => {
    if (typeof window === 'undefined') return defaults
    const params = new URLSearchParams(window.location.search)
    const next = { ...defaults }
    for (const key of Object.keys(defaults)) {
      if (params.has(key)) {
        const raw = params.get(key) as string
        const defaultValue = defaults[key]
        ;(next as Record<string, UrlQueryValue>)[key] = typeof defaultValue === 'number' ? Number(raw) : raw
      }
    }
    return next
  }, [defaults])

  const [state, setState] = useState<T>(readFromLocation)

  useEffect(() => {
    // SSR では defaults を初期値にしているため、マウント後に実際の URL クエリへ同期する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(readFromLocation())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const update = useCallback(
    (patch: Partial<T>, options?: { replace?: boolean }) => {
      const merged = { ...state, ...patch }
      setState(merged)
      if (typeof window === 'undefined') return
      const params = new URLSearchParams(window.location.search)
      for (const [key, value] of Object.entries(merged)) {
        if (value === undefined || value === '') params.delete(key)
        else params.set(key, String(value))
      }
      const url = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
      if (options?.replace) window.history.replaceState(null, '', url)
      else window.history.pushState(null, '', url)
    },
    [state],
  )

  return [state, update]
}
