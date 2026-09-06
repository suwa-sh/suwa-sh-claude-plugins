import React from 'react'
import { Button, type ButtonVariant } from '@/components/ui/Button'

export interface SubmitActionButtonProps {
  idempotencyKey?: string
  /** 破壊的操作は destructive、主操作は default、副次操作は outline、ナビ的操作は ghost */
  variant?: ButtonVariant
  onSubmit: () => void
  submitting?: boolean
  disabled?: boolean
  children: React.ReactNode
}

/**
 * 更新系 API の二重送信防止を 1 箇所に集約する。押下で disabled + aria-busy="true" + loading にし、
 * 画面表示時に発行した冪等キー（UUID）を X-Idempotency-Key として送る（arch SR-002 / LR-032）。
 * 館内タブレット運用のためタップ領域は 2.75rem 以上を確保する（size lg）。
 */
export const SubmitActionButton: React.FC<SubmitActionButtonProps> = ({
  idempotencyKey,
  variant = 'default',
  onSubmit,
  submitting = false,
  disabled = false,
  children,
}) => (
  <Button
    variant={variant}
    size="lg"
    loading={submitting}
    disabled={disabled}
    onClick={onSubmit}
    data-idempotency-key={idempotencyKey}
  >
    {children}
  </Button>
)
