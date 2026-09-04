import React from 'react'
import { Button } from '@/components/ui/Button'
import type { IconName } from '@/components/ui/Icon'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  status?: React.ReactNode
  primaryAction?: { label: string; onClick: () => void; icon?: IconName }
  back?: { label: string; onClick: () => void }
  notices?: React.ReactNode
}

/**
 * ページ見出し + 状態バッジ + 主要操作 + 通知領域を固定レイアウトで並べる。
 * status → primaryAction の順で視覚階層をつける。
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, status, primaryAction, back, notices }) => (
  <div className="flex flex-col" style={{ gap: 'var(--spacing-3)', marginBottom: 'var(--section-gap)' }}>
    {back ? (
      <div>
        <Button variant="ghost" size="sm" icon="arrow-left" onClick={back.onClick}>
          {back.label}
        </Button>
      </div>
    ) : null}
    <div className="flex flex-wrap items-start justify-between" style={{ gap: 'var(--spacing-4)' }}>
      <div className="flex min-w-0 flex-col" style={{ gap: 'var(--spacing-1)' }}>
        <div className="flex flex-wrap items-center" style={{ gap: 'var(--spacing-2)' }}>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>{title}</h1>
          {status ?? null}
        </div>
        {subtitle ? <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>{subtitle}</p> : null}
      </div>
      {primaryAction ? (
        <Button variant="default" icon={primaryAction.icon} onClick={primaryAction.onClick}>
          {primaryAction.label}
        </Button>
      ) : null}
    </div>
    {notices ? <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>{notices}</div> : null}
  </div>
)
