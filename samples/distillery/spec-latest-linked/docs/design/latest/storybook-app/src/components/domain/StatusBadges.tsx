import React from 'react'
import { Badge } from '../ui/Badge'
import {
  bookStateStyle,
  loanStateStyle,
  reservationStateStyle,
  userStateStyle,
  notificationStateStyle,
  reportStateStyle,
} from './stateMaps'
import type {
  BookState,
  LoanState,
  ReservationState,
  UserState,
  NotificationState,
  ReportState,
} from './stateMaps'

/**
 * RDRA 状態モデル → Badge の薄いラッパー群。
 * variant / icon は stateMaps.ts の *StateStyle が単一の正本。ここでは判定しない。
 */

export interface StateBadgeProps {
  /** 色だけに依存しない表示にしたい場合（テーブル内の状態列など）に true */
  dot?: boolean
}

export interface BookStatusBadgeProps extends StateBadgeProps {
  state: BookState
}

export const BookStatusBadge: React.FC<BookStatusBadgeProps> = ({ state, dot = false }) => {
  const s = bookStateStyle[state]
  return (
    <Badge variant={s.variant} icon={s.icon} dot={dot}>
      {state}
    </Badge>
  )
}

export interface LoanStatusBadgeProps extends StateBadgeProps {
  state: LoanState
}

export const LoanStatusBadge: React.FC<LoanStatusBadgeProps> = ({ state, dot = false }) => {
  const s = loanStateStyle[state]
  return (
    <Badge variant={s.variant} icon={s.icon} dot={dot}>
      {state}
    </Badge>
  )
}

export interface ReservationStatusBadgeProps extends StateBadgeProps {
  state: ReservationState
}

export const ReservationStatusBadge: React.FC<ReservationStatusBadgeProps> = ({
  state,
  dot = false,
}) => {
  const s = reservationStateStyle[state]
  return (
    <Badge variant={s.variant} icon={s.icon} dot={dot}>
      {state}
    </Badge>
  )
}

export interface UserStatusBadgeProps extends StateBadgeProps {
  state: UserState
}

export const UserStatusBadge: React.FC<UserStatusBadgeProps> = ({ state, dot = false }) => {
  const s = userStateStyle[state]
  return (
    <Badge variant={s.variant} icon={s.icon} dot={dot}>
      {state}
    </Badge>
  )
}

export interface NotificationStatusBadgeProps extends StateBadgeProps {
  state: NotificationState
}

export const NotificationStatusBadge: React.FC<NotificationStatusBadgeProps> = ({
  state,
  dot = false,
}) => {
  const s = notificationStateStyle[state]
  return (
    <Badge variant={s.variant} icon={s.icon} dot={dot}>
      {state}
    </Badge>
  )
}

export interface ReportStatusBadgeProps extends StateBadgeProps {
  state: ReportState
}

export const ReportStatusBadge: React.FC<ReportStatusBadgeProps> = ({ state, dot = false }) => {
  const s = reportStateStyle[state]
  return (
    <Badge variant={s.variant} icon={s.icon} dot={dot}>
      {state}
    </Badge>
  )
}
