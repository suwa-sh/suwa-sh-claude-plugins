import React from 'react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { ToggleGroup, type ToggleOption } from '@/components/ui/ToggleGroup'
import { Alert } from '@/components/ui/Feedback'

export interface FormFieldSpec {
  key: string
  label: string
  kind: 'text' | 'single' | 'multi'
  options?: ToggleOption[]
  required?: boolean
  type?: React.HTMLInputTypeAttribute
  suffix?: string
  hint?: string
}

export interface EntityFormSectionProps {
  title: string
  description?: string
  /** create: 新規登録 / edit: 編集（差分サマリを出す） / action: 判定・実行系 */
  mode: 'create' | 'edit' | 'action'
  fields: FormFieldSpec[]
  value: Record<string, string | string[]>
  onChange: (key: string, value: string | string[]) => void
  /** edit 時の現行値。差分算出に使う */
  current?: Record<string, string | string[]>
  errors?: Record<string, string>
  formError?: string | null
  footer: React.ReactNode
}

function toDisplay(v: string | string[] | undefined): string {
  if (v == null) return ''
  return Array.isArray(v) ? v.join('、') : String(v)
}

/**
 * フォームのレイアウト（lg 2 列 / md 以下 1 列）、ラベル・必須表記・エラー表示位置、
 * 送信中の無効化を統一する。現在値（current）と入力値（draft）を分けて保持する編集系の型を提供する。
 */
export const EntityFormSection: React.FC<EntityFormSectionProps> = ({
  title,
  description,
  mode,
  fields,
  value,
  onChange,
  current,
  errors = {},
  formError,
  footer,
}) => {
  const dirtyFields =
    mode === 'edit' && current
      ? fields.filter((f) => toDisplay(value[f.key]) !== toDisplay(current[f.key]))
      : []

  return (
    <Card>
      <CardHeader title={title} description={description} />
      {formError && (
        <div style={{ marginBottom: 'var(--component-gap)' }}>
          <Alert tone="destructive" title={formError} />
        </div>
      )}
      {mode === 'edit' && dirtyFields.length > 0 && (
        <div style={{ marginBottom: 'var(--component-gap)' }}>
          <Alert tone="info" title={`変更した項目（${dirtyFields.length} 件）`}>
            {dirtyFields.map((f) => f.label).join('、')}
          </Alert>
        </div>
      )}
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 'var(--component-gap)',
        }}
      >
        {fields.map((f) => (
          <div key={f.key} style={{ gridColumn: f.kind === 'text' ? undefined : 'span 2' }}>
            {f.kind === 'text' ? (
              <Input
                label={f.label}
                type={f.type ?? 'text'}
                required={f.required}
                suffix={f.suffix}
                hint={f.hint}
                error={errors[f.key]}
                value={toDisplay(value[f.key])}
                onChange={(e) => onChange(f.key, e.target.value)}
              />
            ) : (
              <ToggleGroup
                label={f.label}
                options={f.options ?? []}
                mode={f.kind === 'multi' ? 'multi' : 'single'}
                value={Array.isArray(value[f.key]) ? (value[f.key] as string[]) : [value[f.key] as string].filter(Boolean)}
                onChange={(next) => onChange(f.key, f.kind === 'multi' ? next : next[0] ?? '')}
              />
            )}
            {errors[f.key] && f.kind !== 'text' && (
              <span role="alert" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--destructive)' }}>
                {errors[f.key]}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end" style={{ marginTop: 'var(--component-gap)', gap: 'var(--spacing-2)' }}>
        {footer}
      </div>
    </Card>
  )
}
