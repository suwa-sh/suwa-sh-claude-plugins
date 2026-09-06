import React from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'

export interface ConfirmActionModalProps {
  open: boolean
  /** confirm: 24rem sm / destructive: 32rem md */
  tone: 'confirm' | 'destructive'
  title: string
  /** 対象名の再掲 */
  targetLabel: string
  /** 実行後に起きること */
  impact: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  submitting?: boolean
}

/**
 * 確認ダイアログの文言構造（対象名の再掲 → 影響の明示 → 取り消し可否）とフォーカス制御を統一する。
 * window.confirm と Alert による代替を禁止する。
 */
export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  open,
  tone,
  title,
  targetLabel,
  impact,
  confirmLabel,
  onConfirm,
  onCancel,
  submitting = false,
}) => (
  <Modal
    open={open}
    onClose={onCancel}
    title={title}
    size={tone === 'destructive' ? 'md' : 'sm'}
    footer={
      <>
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          キャンセル
        </Button>
        <Button
          variant={tone === 'destructive' ? 'destructive' : 'default'}
          onClick={onConfirm}
          loading={submitting}
          autoFocus={false}
        >
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="flex flex-col" style={{ gap: 'var(--spacing-3)' }}>
      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{targetLabel}</div>
      <Alert tone={tone === 'destructive' ? 'warning' : 'info'} title="実行すると">
        {impact}
      </Alert>
    </div>
  </Modal>
)
