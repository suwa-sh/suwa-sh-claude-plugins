import React, { useId } from 'react'
import { Icon } from './Icon'

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  /** エラーメッセージ。指定すると枠線が destructive になり aria-invalid が立つ */
  error?: string
  hint?: string
  /** 先頭アイコン名 */
  iconLeft?: string
  /** 末尾の単位・接尾語（「冊」「日」等）。placeholder を潰さない */
  suffix?: string
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  iconLeft,
  suffix,
  id,
  className = '',
  style,
  ...rest
}) => {
  const autoId = useId()
  const inputId = id ?? autoId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className="flex flex-col" style={{ gap: 'var(--spacing-1)', minWidth: 0 }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 500,
            color: 'var(--foreground-secondary)',
          }}
        >
          {label}
          {rest.required && (
            <span style={{ color: 'var(--destructive)', marginLeft: 4 }} aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <div
        className="flex items-center"
        style={{
          gap: 'var(--spacing-2)',
          height: 'var(--input-height)',
          padding: '0 var(--input-padding-x)',
          background: 'var(--input-bg)',
          border: `1px solid ${error ? 'var(--destructive)' : 'var(--input-border)'}`,
          borderRadius: 'var(--input-radius)',
          minWidth: 0,
        }}
      >
        {iconLeft && (
          <span style={{ color: 'var(--foreground-muted)', display: 'inline-flex' }}>
            <Icon name={iconLeft} size={16} />
          </span>
        )}
        <input
          {...rest}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`ds-input flex-1 min-w-0 bg-transparent ${className}`}
          style={{
            border: 'none',
            outline: 'none',
            color: 'var(--foreground)',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-family-sans)',
            height: '100%',
            ...style,
          }}
        />
        {suffix && (
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--foreground-muted)',
              flexShrink: 0,
            }}
          >
            {suffix}
          </span>
        )}
      </div>
      {error ? (
        <span
          id={`${inputId}-error`}
          role="alert"
          style={{ fontSize: 'var(--font-size-xs)', color: 'var(--destructive)' }}
        >
          {error}
        </span>
      ) : (
        hint && (
          <span
            id={`${inputId}-hint`}
            style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}
          >
            {hint}
          </span>
        )
      )}
    </div>
  )
}
