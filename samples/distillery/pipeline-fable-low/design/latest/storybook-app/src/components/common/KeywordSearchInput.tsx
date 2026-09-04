import React from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export interface KeywordSearchInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder: string
  maxLength?: number
  error?: string
  disabled?: boolean
  autoFocus?: boolean
}

/**
 * 単一条件（利用者番号 / 氏名）の検索入力。Enter で送信、補助検証、送信中 disabled を統一する。
 */
export const KeywordSearchInput: React.FC<KeywordSearchInputProps> = ({ value, onChange, onSubmit, placeholder, maxLength = 100, error, disabled, autoFocus }) => (
  <form
    className="flex items-start"
    style={{ gap: 'var(--spacing-2)' }}
    onSubmit={(e) => {
      e.preventDefault()
      onSubmit()
    }}
  >
    <div className="min-w-0 flex-1">
      <Input
        icon="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        error={error}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={placeholder}
      />
    </div>
    <Button type="submit" variant="default" icon="search" disabled={disabled}>
      検索
    </Button>
  </form>
)
