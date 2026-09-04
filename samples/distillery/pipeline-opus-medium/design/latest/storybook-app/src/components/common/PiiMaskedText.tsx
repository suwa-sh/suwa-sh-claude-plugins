import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'

export type PiiKind = 'email' | 'phone' | 'address'

export interface PiiMaskedTextProps {
  value: string
  kind: PiiKind
  /** 既定 false。true のとき明示操作で開示できる */
  revealable?: boolean
  onReveal?: () => void
}

function mask(value: string, kind: PiiKind): string {
  if (kind === 'email') {
    const [local, domain] = value.split('@')
    if (!domain) return '非表示'
    return `${local.slice(0, 1)}***@${domain}`
  }
  if (kind === 'phone') {
    return `${value.slice(0, 3)}-****-${value.slice(-4)}`
  }
  return '非表示（住所）'
}

/**
 * 連絡先など個人情報の既定マスクと明示操作による開示を 1 箇所に集約する（NFR E.1.2.1 / arch SR-006）。
 * 開示状態は画面遷移で破棄する。マスク済みであることは背景色だけでなく文言でも示す。
 */
export const PiiMaskedText: React.FC<PiiMaskedTextProps> = ({ value, kind, revealable = false, onReveal }) => {
  const [revealed, setRevealed] = useState(false)

  return (
    <span className="inline-flex items-center" style={{ gap: 'var(--spacing-2)' }}>
      <span
        style={{
          background: revealed ? 'transparent' : 'var(--pii-mask-bg)',
          color: revealed ? 'var(--foreground)' : 'var(--pii-mask-color)',
          padding: revealed ? 0 : '0 var(--spacing-2)',
          borderRadius: 'var(--radius-md)',
          fontFamily: 'var(--font-family-mono)',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        {revealed ? value : mask(value, kind)}
      </span>
      {revealable && (
        <Button
          variant="ghost"
          size="sm"
          iconLeft={revealed ? 'eye-off' : 'eye'}
          onClick={() => {
            const next = !revealed
            setRevealed(next)
            if (next) onReveal?.()
          }}
        >
          {revealed ? '隠す' : '表示する'}
        </Button>
      )}
    </span>
  )
}
