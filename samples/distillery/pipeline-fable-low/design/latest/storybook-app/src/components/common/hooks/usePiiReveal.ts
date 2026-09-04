import { useCallback, useState } from 'react'

export interface UsePiiRevealOptions {
  /** 開示要求時に実データを取得する（reveal=true 再取得）。省略時は即時開示のみ行う */
  fetchRevealed?: (key: string) => Promise<string>
}

/**
 * PiiMaskedText の開示状態（行別 / kind 別の key で管理）と reveal=true 再取得を統一する。
 * 開示は画面内状態のみでセッション永続化しない（NFR E.1.2.1 / E.6.1.1）。
 */
export function usePiiReveal(options: UsePiiRevealOptions = {}) {
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set())
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({})
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set())

  const isRevealed = useCallback((key: string) => revealedKeys.has(key), [revealedKeys])
  const isLoading = useCallback((key: string) => loadingKeys.has(key), [loadingKeys])
  const valueOf = useCallback((key: string) => revealedValues[key], [revealedValues])

  const reveal = useCallback(
    async (key: string) => {
      if (revealedKeys.has(key)) return
      if (options.fetchRevealed) {
        setLoadingKeys((prev) => new Set(prev).add(key))
        try {
          const value = await options.fetchRevealed(key)
          setRevealedValues((prev) => ({ ...prev, [key]: value }))
        } finally {
          setLoadingKeys((prev) => {
            const next = new Set(prev)
            next.delete(key)
            return next
          })
        }
      }
      setRevealedKeys((prev) => new Set(prev).add(key))
    },
    [options, revealedKeys],
  )

  const hide = useCallback((key: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }, [])

  const toggle = useCallback(
    (key: string) => {
      if (revealedKeys.has(key)) hide(key)
      else void reveal(key)
    },
    [hide, reveal, revealedKeys],
  )

  return { isRevealed, isLoading, valueOf, reveal, hide, toggle }
}
