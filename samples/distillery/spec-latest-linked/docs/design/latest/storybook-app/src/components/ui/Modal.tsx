import React from 'react'
import { Icon } from './Icon'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md'
}

/** 除籍手続・退会手続・予約取消などの確認ダイアログに使う */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}) => {
  if (!open) return null
  return (
    <div
      className="flex items-center justify-center"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--modal-backdrop)',
        padding: 'var(--spacing-4)',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: size === 'sm' ? 'var(--modal-width-sm)' : 'var(--modal-width-md)',
          background: 'var(--modal-bg)',
          borderRadius: 'var(--modal-radius)',
          boxShadow: 'var(--modal-shadow)',
          border: '1px solid var(--border)',
          padding: 'var(--modal-padding)',
          color: 'var(--foreground)',
        }}
      >
        <div className="flex items-start justify-between" style={{ gap: 'var(--spacing-4)' }}>
          <div style={{ minWidth: 0 }}>
            <h2
              style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 600,
                lineHeight: 'var(--line-height-tight)',
                margin: 0,
              }}
            >
              {title}
            </h2>
            {description && (
              <p
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--foreground-secondary)',
                  marginTop: 'var(--spacing-2)',
                }}
              >
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            className="ds-button shrink-0 inline-flex items-center justify-center"
            data-variant="ghost"
            style={{
              width: 'var(--button-height-md)',
              height: 'var(--button-height-md)',
              borderRadius: 'var(--radius-lg)',
              background: 'transparent',
              border: '1px solid transparent',
              color: 'var(--foreground-secondary)',
              cursor: 'pointer',
            }}
          >
            <Icon name="x-circle" size={18} />
          </button>
        </div>
        {children && <div style={{ marginTop: 'var(--component-gap)' }}>{children}</div>}
        {footer && (
          <div
            className="flex items-center justify-end"
            style={{ gap: 'var(--spacing-2)', marginTop: 'var(--spacing-6)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
