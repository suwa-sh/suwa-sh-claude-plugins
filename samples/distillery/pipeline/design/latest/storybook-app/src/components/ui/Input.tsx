import React, { useId } from 'react'
import { Icon, type IconName } from './Icon'

export interface FieldProps {
  label?: string
  hint?: string
  error?: string
  required?: boolean
}

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>, FieldProps {
  icon?: IconName
  mono?: boolean
}

const fieldFrame = (error?: string): React.CSSProperties => ({
  height: 'var(--input-height)',
  paddingInline: 'var(--input-padding-x)',
  borderRadius: 'var(--input-radius)',
  background: 'var(--input-bg)',
  borderColor: error ? 'var(--destructive)' : 'var(--input-border)',
  color: 'var(--foreground)',
  fontSize: 'var(--font-size-sm)',
})

export const FieldWrap: React.FC<FieldProps & { id: string; children: React.ReactNode; className?: string }> = ({
  id,
  label,
  hint,
  error,
  required,
  children,
  className = '',
}) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    {label ? (
      <label htmlFor={id} style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
        {label}
        {required ? (
          <span style={{ color: 'var(--destructive)', marginLeft: 4 }} aria-label="必須">
            *
          </span>
        ) : null}
      </label>
    ) : null}
    {children}
    {error ? (
      <p id={`${id}-error`} role="alert" className="flex items-center gap-1" style={{ color: 'var(--destructive)', fontSize: 'var(--font-size-xs)' }}>
        <Icon name="alert-triangle" size={12} />
        {error}
      </p>
    ) : hint ? (
      <p id={`${id}-hint`} style={{ color: 'var(--foreground-muted)', fontSize: 'var(--font-size-xs)' }}>
        {hint}
      </p>
    ) : null}
  </div>
)

export const Input: React.FC<InputProps> = ({ label, hint, error, required, icon, mono, id, className = '', style, disabled, ...rest }) => {
  const auto = useId()
  const inputId = id ?? auto
  return (
    <FieldWrap id={inputId} label={label} hint={hint} error={error} required={required} className={className}>
      <div className="relative flex items-center">
        {icon ? (
          <span className="pointer-events-none absolute left-3" style={{ color: 'var(--foreground-muted)' }}>
            <Icon name={icon} size={16} />
          </span>
        ) : null}
        <input
          id={inputId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className="w-full min-w-0 border outline-none placeholder:text-foreground-muted focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            ...fieldFrame(error),
            paddingLeft: icon ? '2.25rem' : undefined,
            fontFamily: mono ? 'var(--font-family-mono)' : undefined,
            ...style,
          }}
          {...rest}
        />
      </div>
    </FieldWrap>
  )
}

export interface SelectOption {
  value: string
  label: string
}
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement>, FieldProps {
  options: SelectOption[]
  placeholder?: string
}

export const Select: React.FC<SelectProps> = ({ label, hint, error, required, options, placeholder, id, className = '', style, ...rest }) => {
  const auto = useId()
  const selectId = id ?? auto
  return (
    <FieldWrap id={selectId} label={label} hint={hint} error={error} required={required} className={className}>
      <div className="relative flex items-center">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          className="w-full min-w-0 appearance-none border pr-9 outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ ...fieldFrame(error), ...style }}
          {...rest}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3" style={{ color: 'var(--foreground-muted)' }}>
          <Icon name="chevron-down" size={16} />
        </span>
      </div>
    </FieldWrap>
  )
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, FieldProps {}

export const Textarea: React.FC<TextareaProps> = ({ label, hint, error, required, id, className = '', style, ...rest }) => {
  const auto = useId()
  const taId = id ?? auto
  return (
    <FieldWrap id={taId} label={label} hint={hint} error={error} required={required} className={className}>
      <textarea
        id={taId}
        aria-invalid={error ? true : undefined}
        className="w-full min-w-0 border outline-none focus-visible:ring-2 disabled:opacity-60"
        style={{ ...fieldFrame(error), height: 'auto', minHeight: '5rem', paddingBlock: 'var(--spacing-2)', ...style }}
        {...rest}
      />
    </FieldWrap>
  )
}
