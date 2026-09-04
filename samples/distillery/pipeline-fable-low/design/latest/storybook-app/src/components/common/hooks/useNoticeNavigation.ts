import { useCallback } from 'react'

export type NoticeKind = 'created' | 'updated' | 'deleted' | 'cancelled'

/**
 * 完了後の遷移先 URL を「親パス + returnQuery + notice」で組み立て、履歴を replace で遷移する。
 * ConfirmPage / EntityFormPage の完了ハンドラから利用する。
 */
export function useNoticeNavigation() {
  const navigate = useCallback((to: string, notice: NoticeKind, returnQuery?: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams()
    if (returnQuery) {
      for (const [key, value] of Object.entries(returnQuery)) {
        if (value !== undefined && value !== '') params.set(key, String(value))
      }
    }
    params.set('notice', notice)
    const url = `${to}?${params.toString()}`
    if (typeof window === 'undefined') return url
    window.location.replace(url)
    return url
  }, [])

  return { navigate }
}
