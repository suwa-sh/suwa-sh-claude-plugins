import React, { useEffect } from 'react'
import { Button } from './Button'
import { Icon } from './Icon'

export interface ModalProps {
  open: boolean
  title: string
  description?: string
  children?: React.ReactNode
  tone?: 'confirm' | 'destructive-confirm'
  size?: 'sm' | 'md'
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  submitting?: boolean
  /** Storybook 等でオーバーレイを親要素内に収める */
  inline?: boolean
}

/**
 * 状態変更操作の確認ダイアログ（arch SR-005）。submitting 中は両ボタンを無効化する。
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  title,
  description,
  children,
  tone = 'confirm',
  size = 'sm',
  confirmLabel = '確定する',
  cancelLabel = '戻る',
  onConfirm,
  onCancel,
  submitting,
  inline,
}) => {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, submitting, onCancel])

  if (!open) return null
  return (
    <div
      className={`${inline ? 'absolute' : 'fixed'} inset-0 z-50 flex items-center justify-center`}
      style={{ background: 'var(--modal-backdrop)', padding: 'var(--spacing-4)' }}
      onClick={submitting ? undefined : onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="libro-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full"
        style={{
          maxWidth: size === 'sm' ? 'var(--modal-width-sm)' : 'var(--modal-width-md)',
          background: 'var(--card-bg)',
          borderRadius: 'var(--modal-radius)',
          boxShadow: 'var(--modal-shadow)',
          padding: 'var(--modal-padding)',
          color: 'var(--foreground)',
        }}
      >
        <div className="flex items-start" style={{ gap: 'var(--spacing-3)' }}>
          <span style={{ color: tone === 'destructive-confirm' ? 'var(--destructive)' : 'var(--primary)', marginTop: 2 }}>
            <Icon name={tone === 'destructive-confirm' ? 'alert-triangle' : 'info'} size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="libro-modal-title" style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>
              {title}
            </h2>
            {description ? (
              <p style={{ color: 'var(--foreground-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-1)' }}>{description}</p>
            ) : null}
            {children ? <div style={{ marginTop: 'var(--spacing-3)' }}>{children}</div> : null}
          </div>
        </div>
        <div className="flex justify-end" style={{ gap: 'var(--spacing-2)', marginTop: 'var(--spacing-6)' }}>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'destructive-confirm' ? 'destructive' : 'default'} onClick={onConfirm} loading={submitting}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
