import React from 'react'
import { Button } from '@/components/ui/Button'

export interface CounterHandoffActionsProps {
  /** あれば「貸出受付へ」に ?userNumber= を付与 */
  userNumber?: string
  /** あれば「返却受付へ」「貸出受付へ」に ?bookId= を付与 */
  bookId?: string
  actions: ('loan' | 'return')[]
  /** 貸出不可（電子書籍 / 貸出中）のとき「貸出受付へ」を非表示または disabled */
  disabled?: boolean
}

const buildHref = (base: string, userNumber?: string, bookId?: string) => {
  const params = new URLSearchParams()
  if (userNumber) params.set('userNumber', userNumber)
  if (bookId) params.set('bookId', bookId)
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

/**
 * 照会・一覧画面から窓口受付画面（貸出受付 / 返却受付）へ、利用者番号・書籍 ID をクエリで引き継いで遷移するボタン群。
 */
export const CounterHandoffActions: React.FC<CounterHandoffActionsProps> = ({ userNumber, bookId, actions, disabled }) => {
  const go = (href: string) => {
    if (typeof window !== 'undefined') window.location.assign(href)
  }
  return (
    <div className="flex flex-wrap items-center" style={{ gap: 'var(--spacing-2)' }}>
      {actions.includes('loan') && !disabled ? (
        <Button variant="secondary" size="sm" icon="book-open" onClick={() => go(buildHref('/staff/loans/new', userNumber, bookId))}>
          貸出受付へ
        </Button>
      ) : null}
      {actions.includes('return') ? (
        <Button variant="secondary" size="sm" icon="rotate-ccw" onClick={() => go(buildHref('/staff/returns/new', userNumber, bookId))}>
          返却受付へ
        </Button>
      ) : null}
    </div>
  )
}
