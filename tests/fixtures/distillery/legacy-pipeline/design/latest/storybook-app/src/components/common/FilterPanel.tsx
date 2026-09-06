import React, { useState } from 'react'
import { ToggleGroup } from '@/components/ui/ToggleGroup'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export interface FilterFieldOption {
  value: string
  label: string
}

export interface FilterFieldSpec {
  key: string
  label: string
  kind: 'single' | 'multi' | 'text'
  options?: FilterFieldOption[]
  value: string[] | string
}

export interface FilterPanelProps {
  fields: FilterFieldSpec[]
  onChange: (key: string, value: string[] | string) => void
  onSubmit: () => void
  onReset?: () => void
  resultCount?: number
  /** 既定 true。既定表示はキーワードのみ、詳細条件は折りたたむ */
  collapsedByDefault?: boolean
  submitting?: boolean
}

/**
 * 「単一選択トグル + 複数選択トグル + 検索語 + 実行ボタン + 結果件数」の並びと、
 * 詳細条件の折りたたみ（段階的開示）を統一する。セレクトボックスは使わない。
 */
export const FilterPanel: React.FC<FilterPanelProps> = ({
  fields,
  onChange,
  onSubmit,
  onReset,
  resultCount,
  collapsedByDefault = true,
  submitting = false,
}) => {
  const [expanded, setExpanded] = useState(!collapsedByDefault)
  const textFields = fields.filter((f) => f.kind === 'text')
  const toggleFields = fields.filter((f) => f.kind !== 'text')
  const primaryToggle = toggleFields[0]
  const detailToggles = toggleFields.slice(1)

  return (
    <div
      className="flex flex-col"
      style={{
        gap: 'var(--component-gap)',
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--card-radius)',
        padding: 'var(--card-padding)',
      }}
    >
      <div className="flex flex-wrap items-end" style={{ gap: 'var(--component-gap)' }}>
        {textFields.map((f) => (
          <div key={f.key} style={{ flex: '1 1 16rem', minWidth: '12rem' }}>
            <Input
              label={f.label}
              iconLeft="search"
              value={f.value as string}
              onChange={(e) => onChange(f.key, e.target.value)}
            />
          </div>
        ))}
        {primaryToggle && (
          <ToggleGroup
            label={primaryToggle.label}
            options={primaryToggle.options ?? []}
            mode={primaryToggle.kind === 'multi' ? 'multi' : 'single'}
            value={Array.isArray(primaryToggle.value) ? primaryToggle.value : [primaryToggle.value]}
            onChange={(v) => onChange(primaryToggle.key, v)}
          />
        )}
        <div className="flex items-center" style={{ gap: 'var(--spacing-2)' }}>
          <Button variant="default" iconLeft="search" loading={submitting} onClick={onSubmit}>
            検索
          </Button>
          {onReset && (
            <Button variant="ghost" onClick={onReset}>
              条件クリア
            </Button>
          )}
          {detailToggles.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              iconRight={expanded ? 'chevron-down' : 'chevron-right'}
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              詳細条件
            </Button>
          )}
        </div>
      </div>

      {expanded && detailToggles.length > 0 && (
        <div className="flex flex-wrap" style={{ gap: 'var(--component-gap)' }}>
          {detailToggles.map((f) => (
            <ToggleGroup
              key={f.key}
              label={f.label}
              options={f.options ?? []}
              mode={f.kind === 'multi' ? 'multi' : 'single'}
              value={Array.isArray(f.value) ? f.value : [f.value]}
              onChange={(v) => onChange(f.key, v)}
              size="sm"
            />
          ))}
        </div>
      )}

      {resultCount != null && (
        <span aria-live="polite" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>
          該当 {resultCount.toLocaleString('ja-JP')} 件
        </span>
      )}
    </div>
  )
}
