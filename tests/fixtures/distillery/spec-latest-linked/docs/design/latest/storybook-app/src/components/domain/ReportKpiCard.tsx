import React from 'react'
import { Icon } from '../ui/Icon'

export type KpiTone = 'default' | 'success' | 'warning' | 'destructive'

export interface ReportKpiCardProps {
  label: string
  value: number | string
  unit?: string
  icon?: string
  /** 前期比 */
  delta?: { value: number; label: string }
  tone?: KpiTone
}

const toneAccent: Record<KpiTone, string> = {
  default: 'var(--kpi-accent)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  destructive: 'var(--destructive)',
}

/** 在庫状況レポート画面・貸出統計レポート画面の KPI カード */
export const ReportKpiCard: React.FC<ReportKpiCardProps> = ({
  label,
  value,
  unit,
  icon,
  delta,
  tone = 'default',
}) => {
  const accent = toneAccent[tone]
  const up = delta ? delta.value > 0 : false
  const flat = delta ? delta.value === 0 : false
  const deltaColor = flat
    ? 'var(--foreground-muted)'
    : up
      ? 'var(--success-foreground)'
      : 'var(--destructive-foreground)'
  const deltaIcon = flat ? 'arrow-right' : up ? 'chart-bar' : 'alert-triangle'
  const deltaText = delta
    ? `${up ? '+' : ''}${delta.value.toLocaleString('ja-JP')}%`
    : ''

  return (
    <div
      className="flex flex-col"
      style={{
        gap: 'var(--spacing-2)',
        background: 'var(--kpi-bg)',
        border: '1px solid var(--card-border)',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 'var(--card-radius)',
        boxShadow: 'var(--card-shadow)',
        padding: 'var(--card-padding)',
      }}
    >
      <div className="flex items-center" style={{ gap: 'var(--spacing-2)' }}>
        {icon && (
          <span style={{ color: accent, display: 'inline-flex' }}>
            <Icon name={icon} size={16} />
          </span>
        )}
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--kpi-label-color)' }}>
          {label}
        </span>
      </div>

      <div className="flex items-baseline" style={{ gap: 'var(--spacing-1)' }}>
        <span
          style={{
            fontFamily: 'var(--font-family-mono)',
            fontVariantNumeric: 'tabular-nums',
            fontSize: 'var(--font-size-3xl)',
            fontWeight: 700,
            color: 'var(--kpi-value-color)',
            lineHeight: 1.1,
          }}
        >
          {typeof value === 'number' ? value.toLocaleString('ja-JP') : value}
        </span>
        {unit && (
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--kpi-label-color)' }}>
            {unit}
          </span>
        )}
      </div>

      {delta && (
        <div
          className="flex items-center"
          style={{ gap: 'var(--spacing-1)', color: deltaColor, fontSize: 'var(--font-size-xs)' }}
        >
          <Icon name={deltaIcon} size={14} label={flat ? '横ばい' : up ? '増加' : '減少'} />
          <span style={{ fontFamily: 'var(--font-family-mono)', fontVariantNumeric: 'tabular-nums' }}>
            {deltaText}
          </span>
          <span style={{ color: 'var(--kpi-label-color)' }}>{delta.label}</span>
        </div>
      )}
    </div>
  )
}
