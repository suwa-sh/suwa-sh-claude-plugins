import React, { useId } from 'react'
import { Icon } from '@/components/ui/Icon'

export interface CollapsibleSectionProps {
  title: string
  open: boolean
  onToggle: (open: boolean) => void
  count?: number
  children: React.ReactNode
}

/**
 * 補助情報（NotificationLogTable 等）を折りたたみで段階的に開示する。
 * OverdueTable の行展開はこのコンポーネントを行内に埋め込んで使う。
 */
export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, open, onToggle, count, children }) => {
  const contentId = useId()
  return (
    <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => onToggle(!open)}
        className="inline-flex cursor-pointer items-center hover:bg-hover-muted"
        style={{ gap: 'var(--spacing-1)', padding: 'var(--spacing-1) var(--spacing-2)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--foreground-secondary)', alignSelf: 'flex-start' }}
      >
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} />
        {title}
        {count !== undefined ? <span style={{ color: 'var(--foreground-muted)', fontWeight: 400 }}>（{count}）</span> : null}
      </button>
      {open ? (
        <div id={contentId} style={{ paddingLeft: 'var(--spacing-4)' }}>
          {children}
        </div>
      ) : null}
    </div>
  )
}
