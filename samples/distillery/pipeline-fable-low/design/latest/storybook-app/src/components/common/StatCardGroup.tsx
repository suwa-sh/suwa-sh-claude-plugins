import React from 'react'
import { StatCard } from '@/components/domain/Reports'
import type { IconName } from '@/components/ui/Icon'

export interface StatCardGroupItem {
  key: string
  label: string
  value: number | null
  unit?: string
  delta?: number
  icon?: IconName
  tone?: 'default' | 'destructive'
}

export interface StatCardGroupProps {
  /** 2〜4 件（ux-design: StatCard は 1 画面 3〜4 枚まで） */
  items: StatCardGroupItem[]
  loading: boolean
  loadingLabel?: string
  /** 強調するカード（ToggleGroup と連動） */
  activeKey?: string
  onSelect?: (key: string) => void
}

/**
 * StatCard を 2〜4 枚横並びにし、集計中 Skeleton（card × n）と選択連動を提供する。
 * tone = destructive は value >= 1 のときのみ強調する。
 */
export const StatCardGroup: React.FC<StatCardGroupProps> = ({ items, loading, loadingLabel, activeKey, onSelect }) => (
  <div role={onSelect ? 'group' : undefined} aria-label={onSelect ? loadingLabel : undefined} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--spacing-4)' }}>
    {items.map((item) => {
      const highlight = item.tone === 'destructive' && (item.value ?? 0) >= 1
      const isActive = activeKey === item.key
      const content = <StatCard label={item.label} value={item.value ?? 0} unit={item.unit} delta={item.delta} icon={item.icon} tone={highlight ? 'destructive' : 'default'} loading={loading} />
      if (!onSelect) return <div key={item.key}>{content}</div>
      return (
        <button
          key={item.key}
          type="button"
          onClick={() => onSelect(item.key)}
          aria-pressed={isActive}
          className="cursor-pointer text-left"
          style={{ outline: isActive ? '2px solid var(--primary)' : 'none', outlineOffset: 2, borderRadius: 'var(--card-radius)' }}
        >
          {content}
        </button>
      )
    })}
  </div>
)
