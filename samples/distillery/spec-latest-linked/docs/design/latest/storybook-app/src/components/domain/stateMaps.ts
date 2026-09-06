import type { BadgeVariant } from '../ui/Badge'

/**
 * RDRA 状態モデル (docs/rdra/latest/状態.tsv) → Badge のマッピング。
 * 状態名は RDRA の表記をそのまま正とする。ここに無い状態を追加してはならない。
 */
export interface StateStyle {
  variant: BadgeVariant
  icon: string
}

/** 書籍状態（蔵書管理） */
export const bookStates = ['在庫あり', '貸出中', '予約待ち'] as const
export type BookState = (typeof bookStates)[number]
export const bookStateStyle: Record<BookState, StateStyle> = {
  在庫あり: { variant: 'success', icon: 'check-circle' },
  貸出中: { variant: 'info', icon: 'book-open' },
  予約待ち: { variant: 'warning', icon: 'bookmark' },
}

/** 貸出状態（貸出管理） */
export const loanStates = ['貸出中', '延滞', '返却済み'] as const
export type LoanState = (typeof loanStates)[number]
export const loanStateStyle: Record<LoanState, StateStyle> = {
  貸出中: { variant: 'info', icon: 'book-open' },
  延滞: { variant: 'destructive', icon: 'alert-triangle' },
  返却済み: { variant: 'neutral', icon: 'check-circle' },
}

/** 予約状態（予約管理） */
export const reservationStates = ['予約中', '取置き中', '貸出済み', 'キャンセル'] as const
export type ReservationState = (typeof reservationStates)[number]
export const reservationStateStyle: Record<ReservationState, StateStyle> = {
  予約中: { variant: 'info', icon: 'bookmark' },
  取置き中: { variant: 'warning', icon: 'inbox' },
  貸出済み: { variant: 'success', icon: 'check-circle' },
  キャンセル: { variant: 'neutral', icon: 'x-circle' },
}

/** 利用者状態（利用者管理） */
export const userStates = ['登録済み', '取引進行中'] as const
export type UserState = (typeof userStates)[number]
export const userStateStyle: Record<UserState, StateStyle> = {
  登録済み: { variant: 'success', icon: 'check-circle' },
  取引進行中: { variant: 'info', icon: 'refresh-cw' },
}

/** 通知状態（通知管理） */
export const notificationStates = ['送信待ち', '送信済み', '送信失敗'] as const
export type NotificationState = (typeof notificationStates)[number]
export const notificationStateStyle: Record<NotificationState, StateStyle> = {
  送信待ち: { variant: 'warning', icon: 'clock' },
  送信済み: { variant: 'success', icon: 'mail-check' },
  送信失敗: { variant: 'destructive', icon: 'mail-warning' },
}

/** 統計レポート状態（分析管理） */
export const reportStates = ['集計中', '作成済み', '実績なし'] as const
export type ReportState = (typeof reportStates)[number]
export const reportStateStyle: Record<ReportState, StateStyle> = {
  集計中: { variant: 'analysis', icon: 'refresh-cw' },
  作成済み: { variant: 'success', icon: 'check-circle' },
  実績なし: { variant: 'neutral', icon: 'inbox' },
}

/* ------------------------------------------------------------------------
 * バリエーション (docs/rdra/latest/バリエーション.tsv)
 * --------------------------------------------------------------------- */

export const materialTypes = ['紙書籍', '電子書籍'] as const
export const genres = [
  '文学',
  '人文',
  '社会科学',
  '自然科学',
  '技術',
  '芸術',
  '児童',
  'その他',
] as const
export const searchConditionTypes = [
  'キーワード',
  'タイトル',
  '著者',
  'ISBN',
  'ジャンル',
] as const
export const userCategories = ['一般', '学生', '団体'] as const
export const loanPeriodTypes = ['標準', '短期', '長期'] as const
export const notificationTypes = ['取置き案内', '返却期限リマインド', '延滞督促'] as const
export const notificationTimings = ['期限前リマインド', '期限当日', '期限超過督促'] as const
export const reportTypes = ['在庫状況', '人気書籍ランキング', '期間別貸出統計'] as const
export const aggregationPeriods = ['日次', '月次', '年次'] as const
