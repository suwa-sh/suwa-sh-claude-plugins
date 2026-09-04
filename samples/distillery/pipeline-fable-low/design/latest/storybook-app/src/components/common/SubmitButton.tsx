import React from 'react'
import { Button, type ButtonSize } from '@/components/ui/Button'

export interface SubmitButtonProps {
  label: string
  submitting: boolean
  variant?: 'default' | 'destructive' | 'secondary'
  /** sm 未満は md 固定 */
  size?: Extract<ButtonSize, 'md' | 'lg'>
  type?: 'submit' | 'button'
  onClick?: () => void
}

/**
 * 送信ボタンの submitting 連動（disabled + Spinner(sm) + aria-busy）を統一し、二重送信を防ぐ（arch SR-005）。
 */
export const SubmitButton: React.FC<SubmitButtonProps> = ({ label, submitting, variant = 'default', size = 'md', type = 'submit', onClick }) => (
  <Button type={type} variant={variant} size={size} loading={submitting} onClick={onClick}>
    {label}
  </Button>
)
