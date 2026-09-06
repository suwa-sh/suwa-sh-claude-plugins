import React from 'react'
import { Badge, type BadgeVariant } from '../ui/Badge'
import type { IconName } from '../ui/Icon'
import type { BookState, LoanState, ReservationState } from './types'

/** 状態.tsv → Badge variant マッピング（design-event.yaml states と一致させる） */
export const bookStateMap: Record<BookState, { variant: BadgeVariant; icon: IconName; next: string }> = {
  在庫あり: { variant: 'success', icon: 'check-circle', next: '貸出できます' },
  貸出中: { variant: 'info', icon: 'book-open', next: '予約できます' },
  予約待ち: { variant: 'pending', icon: 'bookmark', next: '予約者の来館待ち' },
}

export const loanStateMap: Record<LoanState, { variant: BadgeVariant; icon: IconName }> = {
  貸出中: { variant: 'info', icon: 'book-open' },
  延滞: { variant: 'destructive', icon: 'alert-triangle' },
  返却済み: { variant: 'neutral', icon: 'check' },
}

export const reservationStateMap: Record<ReservationState, { variant: BadgeVariant; icon: IconName }> = {
  予約中: { variant: 'warning', icon: 'clock' },
  通知済み: { variant: 'analysis', icon: 'mail-check' },
  取消: { variant: 'neutral', icon: 'x-circle' },
}

interface BadgeLike {
  dot?: boolean
  className?: string
}

export const BookStatusBadge: React.FC<{ state: BookState } & BadgeLike> = ({ state, dot, className }) => (
  <Badge variant={bookStateMap[state].variant} dot={dot} icon={dot ? undefined : bookStateMap[state].icon} className={className}>
    {state}
  </Badge>
)

export const LoanStatusBadge: React.FC<{ state: LoanState } & BadgeLike> = ({ state, dot, className }) => (
  <Badge variant={loanStateMap[state].variant} dot={dot} icon={dot ? undefined : loanStateMap[state].icon} className={className}>
    {state}
  </Badge>
)

export const ReservationStatusBadge: React.FC<{ state: ReservationState } & BadgeLike> = ({ state, dot, className }) => (
  <Badge variant={reservationStateMap[state].variant} dot={dot} icon={dot ? undefined : reservationStateMap[state].icon} className={className}>
    {state}
  </Badge>
)
