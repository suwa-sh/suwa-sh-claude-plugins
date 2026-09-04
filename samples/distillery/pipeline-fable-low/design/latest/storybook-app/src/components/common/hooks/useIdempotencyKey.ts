import { useCallback, useRef } from 'react'

const generateKey = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/**
 * 確定操作ごとに Idempotency-Key を 1 回だけ生成し、再試行では同じキーを再送する（arch SR-005）。
 * 完了・リセットでキーを破棄する。
 */
export function useIdempotencyKey() {
  const keyRef = useRef<string | null>(null)

  const getKey = useCallback(() => {
    if (!keyRef.current) keyRef.current = generateKey()
    return keyRef.current
  }, [])

  const reset = useCallback(() => {
    keyRef.current = null
  }, [])

  return { getKey, reset }
}
