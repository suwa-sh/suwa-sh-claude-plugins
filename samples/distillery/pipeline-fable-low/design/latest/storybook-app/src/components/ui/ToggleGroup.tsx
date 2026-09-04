import React from 'react'

export interface ToggleOption<V extends string = string> {
  value: V
  label: string
}

interface BaseProps<V extends string> {
  options: ToggleOption<V>[]
  size?: 'sm' | 'md'
  label?: string
  className?: string
  disabled?: boolean
}

export interface SingleProps<V extends string> extends BaseProps<V> {
  mode?: 'single'
  value: V
  onChange: (value: V) => void
}
export interface MultiProps<V extends string> extends BaseProps<V> {
  mode: 'multi'
  value: V[]
  onChange: (value: V[]) => void
}

export type ToggleGroupProps<V extends string> = SingleProps<V> | MultiProps<V>

/**
 * 排他 / 非排他の選択肢を <button> トグルで表示する（Badge をフィルターに使わない）。
 */
export function ToggleGroup<V extends string>(props: ToggleGroupProps<V>) {
  const { options, size = 'md', label, className = '', disabled } = props
  const isSelected = (v: V) => (props.mode === 'multi' ? props.value.includes(v) : props.value === v)
  const toggle = (v: V) => {
    if (props.mode === 'multi') {
      props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v])
    } else {
      props.onChange(v)
    }
  }
  return (
    <div role="group" aria-label={label} className={`inline-flex flex-wrap ${className}`} style={{ gap: 'var(--spacing-1)' }}>
      {options.map((o) => {
        const on = isSelected(o.value)
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => toggle(o.value)}
            className="cursor-pointer border transition-colors hover:bg-hover-muted disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              height: size === 'sm' ? '1.75rem' : 'var(--button-height-sm)',
              paddingInline: size === 'sm' ? 'var(--spacing-2)' : 'var(--spacing-3)',
              borderRadius: 'var(--radius-full)',
              fontSize: size === 'sm' ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
              fontWeight: 500,
              background: on ? 'var(--primary)' : 'var(--background)',
              color: on ? 'var(--primary-foreground)' : 'var(--foreground-secondary)',
              borderColor: on ? 'var(--primary)' : 'var(--border-strong)',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
