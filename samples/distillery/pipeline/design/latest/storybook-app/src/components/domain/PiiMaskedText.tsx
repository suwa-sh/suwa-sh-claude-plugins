import React, { useState } from 'react'
import { Icon } from '../ui/Icon'

export interface PiiMaskedTextProps {
  value: string
  kind?: 'email' | 'phone' | 'address'
  /** false のときは開示ボタンを出さない（利用者ポータル等） */
  revealable?: boolean
  mono?: boolean
}

export const maskPii = (value: string, kind: PiiMaskedTextProps['kind']) => {
  if (!value) return ''
  if (kind === 'email') {
    const [local, domain] = value.split('@')
    return `${local.slice(0, 1)}***@${domain ?? ''}`
  }
  if (kind === 'phone') return value.replace(/\d(?=\d{2,}[-\s]?\d{4}$)/g, '*')
  return `${value.slice(0, 4)}…`
}

/**
 * 個人情報を既定でマスクし、明示操作でのみ開示する（NFR E.1.2.1 / E.6.1.1）。
 */
export const PiiMaskedText: React.FC<PiiMaskedTextProps> = ({ value, kind = 'email', revealable = true, mono }) => {
  const [shown, setShown] = useState(false)
  return (
    <span className="inline-flex items-center" style={{ gap: 'var(--spacing-2)' }}>
      <span
        style={{
          fontFamily: mono || kind !== 'address' ? 'var(--font-family-mono)' : undefined,
          fontSize: 'var(--font-size-sm)',
          color: shown ? 'var(--foreground)' : 'var(--pii-masked-color)',
          background: shown ? 'transparent' : 'var(--pii-masked-bg)',
          paddingInline: shown ? 0 : 'var(--spacing-1)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        {shown ? value : maskPii(value, kind)}
      </span>
      {revealable ? (
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          aria-label={shown ? '個人情報を隠す' : '個人情報を表示する'}
          className="cursor-pointer hover:bg-hover-muted"
          style={{ padding: 2, borderRadius: 'var(--radius-sm)', color: 'var(--foreground-muted)' }}
        >
          <Icon name={shown ? 'eye-off' : 'eye'} size={16} />
        </button>
      ) : null}
    </span>
  )
}
