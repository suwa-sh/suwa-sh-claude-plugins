/** RDRA 情報.tsv / 状態.tsv / バリエーション.tsv に対応する型 */

export type BookState = '在庫あり' | '貸出中' | '予約待ち'
export type LoanState = '貸出中' | '延滞' | '返却済み'
export type ReservationState = '予約中' | '通知済み' | '取消'

export type Genre = '文学' | '社会科学' | '自然科学' | '技術' | '芸術' | '歴史' | '児童書' | 'その他'
export const genres: Genre[] = ['文学', '社会科学', '自然科学', '技術', '芸術', '歴史', '児童書', 'その他']

export type MediaType = '紙' | '電子'
export type SearchKind = 'キーワード' | 'タイトル' | '著者' | 'ISBN' | 'ジャンル'
export const searchKinds: SearchKind[] = ['キーワード', 'タイトル', '著者', 'ISBN', 'ジャンル']

export type NotificationKind = '返却通知' | 'リマインド' | '督促'
export type Granularity = '日' | '月' | '年'

export interface Book {
  id: string
  title: string
  author: string
  isbn: string
  publisher: string
  genre: Genre
  media: MediaType
  state: BookState
  registeredAt: string
  reservationCount?: number
}

export interface User {
  number: string
  name: string
  email: string
  phone: string
  address: string
  registeredAt: string
}

export interface Loan {
  id: string
  book: Pick<Book, 'id' | 'title' | 'author'>
  userNumber: string
  userName?: string
  loanedAt: string
  dueDate: string
  returnedAt?: string
  state: LoanState
}

export interface Reservation {
  id: string
  book: Pick<Book, 'id' | 'title' | 'author'>
  userNumber: string
  userName?: string
  acceptedAt: string
  position: number
  state: ReservationState
}

export interface NotificationLog {
  id: string
  kind: NotificationKind
  to: string
  subject: string
  sentAt: string
  result: '成功' | '失敗'
}

export const formatDate = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export const formatDateTime = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${formatDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const daysBetween = (from: string, to: string) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000)
