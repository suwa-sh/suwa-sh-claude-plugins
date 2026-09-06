import { useMemo, useState } from 'react'

/**
 * 画面表示時に UUID を発行し、送信・再送で同一の X-Idempotency-Key を維持する（arch SR-002 / LR-032）。
 * SubmitActionButton へキーと submitting を渡す。
 */
export function useIdempotentMutation() {
  const idempotencyKey = useMemo(
    () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `key-${Date.now()}`),
    [],
  )
  const [submitting, setSubmitting] = useState(false)

  async function run(fn: () => Promise<void>) {
    setSubmitting(true)
    try {
      await fn()
    } finally {
      setSubmitting(false)
    }
  }

  return { idempotencyKey, submitting, run }
}
