import React from 'react'
import { Alert } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import type { NormalizedApiError } from './types'

export interface ErrorAlertProps {
  error: NormalizedApiError
  onRetry?: () => void
  onReload?: () => void
  /** 文言の丁寧さと理由コード表示の切替。既定は Layout から継承（未指定時 'patron'） */
  audience?: 'patron' | 'staff'
}

/**
 * api client が正規化した統一エラー型を Alert に変換する。
 * HTTP ステータス → 文言・トーン・後続操作の対応を全 UC で統一する。
 */
export const ErrorAlert: React.FC<ErrorAlertProps> = ({ error, onRetry, onReload, audience = 'patron' }) => {
  if (error.kind === 'unauthorized') return null

  const tone = error.kind === 'conflict' ? 'warning' : 'destructive'

  const message = (() => {
    switch (error.kind) {
      case 'forbidden':
        return 'この画面を表示する権限がありません'
      case 'validation':
        return '入力内容を確認してください'
      case 'conflict':
        return '他の司書が更新しました。再読み込みしてください'
      case 'business':
        return error.message
      case 'server':
      case 'network':
        return error.message || '操作できませんでした。しばらくしてからもう一度お試しください'
      default:
        return error.message
    }
  })()

  const action = (() => {
    if (error.kind === 'conflict' && onReload) {
      return (
        <Button variant="secondary" size="sm" icon="refresh-cw" onClick={onReload}>
          再読み込み
        </Button>
      )
    }
    if ((error.kind === 'server' || error.kind === 'network') && onRetry) {
      return (
        <Button variant="secondary" size="sm" icon="refresh-cw" onClick={onRetry}>
          再試行
        </Button>
      )
    }
    return undefined
  })()

  return (
    <Alert tone={tone} title={message} action={action}>
      {audience === 'staff' && error.reasonCode ? <p style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-xs)' }}>理由コード: {error.reasonCode}</p> : null}
    </Alert>
  )
}
