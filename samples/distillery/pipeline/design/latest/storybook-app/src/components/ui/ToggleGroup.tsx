import React from 'react'

export interface ToggleOption {
  value: string
  label: string
}

export interface ToggleGroupProps {
  label?: string
  options: ToggleOption[]
  /** single: 排他選択 / multi: 複数選択 */
  mode?: 'single' | 'multi'
  value: string[]
  onChange: (next: string[]) => void
  size?: 'sm' | 'md'
}

/**
 * バリエーション（検索条件種別・ジャンル・資料種別・貸出期間区分 等）の選択に使う。
 * design-lessons-learned に従い、Badge や 3 択以下の select ではなく button トグルで実装する。
 */
export const ToggleGroup: React.FC<ToggleGroupProps> = ({
  label,
  options,
  mode = 'single',
  value,
  onChange,
  size = 'md',
}) => {
  const toggle = (v: string) => {
    if (mode === 'single') {
      onChange(value[0] === v ? [] : [v])
      return
    }
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  }

  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-col"
      style={{ gap: 'var(--spacing-2)', minWidth: 0 }}
    >
      {label && (
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 500,
            color: 'var(--foreground-secondary)',
          }}
        >
          {label}
        </span>
      )}
      <div className="flex flex-wrap" style={{ gap: 'var(--spacing-2)' }}>
        {options.map((o) => {
          const selected = value.includes(o.value)
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={selected}
              data-selected={selected}
              onClick={() => toggle(o.value)}
              className="ds-toggle inline-flex items-center whitespace-nowrap transition-colors"
              style={{
                height: size === 'sm' ? 'var(--button-height-sm)' : 'var(--button-height-md)',
                padding: '0 var(--spacing-3)',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 500,
                background: selected ? 'var(--primary)' : 'var(--background)',
                color: selected ? 'var(--primary-foreground)' : 'var(--foreground-secondary)',
                border: `1px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                transitionDuration: 'var(--duration-fast)',
                lineHeight: 1,
              }}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
