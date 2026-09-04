import React from 'react'
import { Alert } from '@/components/ui/Feedback'

export type NoticeKind = 'created' | 'updated' | 'deleted' | 'cancelled'

export interface NoticeAlertProps {
  notice: NoticeKind | null
  messages: Partial<Record<NoticeKind, string>>
  onDismiss: () => void
}

/**
 * 前画面の完了結果を URL クエリ `?notice=` で受け取り、Alert（success）を 1 回だけ表示してクエリを除去する。
 * 表示は 1 回限り。ブラウザ戻るで再表示しない（呼び出し側が replace でクエリを除去する。useNoticeNavigation 参照）。
 */
export const NoticeAlert: React.FC<NoticeAlertProps> = ({ notice, messages, onDismiss }) => {
  if (!notice) return null
  const message = messages[notice]
  if (!message) return null

  return (
    <Alert tone="success" action={<button type="button" onClick={onDismiss} aria-label="通知を閉じる" className="cursor-pointer" style={{ color: 'var(--foreground-muted)' }}>×</button>}>
      {message}
    </Alert>
  )
}
