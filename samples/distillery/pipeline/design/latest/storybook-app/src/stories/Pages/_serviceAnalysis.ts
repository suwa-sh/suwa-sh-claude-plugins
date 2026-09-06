import type { Book, Loan, Reservation, BookState, Genre, LoanState, Granularity } from '../../components/domain/types'

// Native API fixtures. Each page records the verified UC contract hash in its metadata.
export const today = '2026-09-06'
export type ViewState = 'ready' | 'loading' | 'empty' | 'error'
export const userResponse = { user_number: 'U-001', name: '山田 花子', email: 'hanako@example.invalid', phone: '090-1234-5678', address: '東京都千代田区丸の内1丁目', user_type: '利用者' as const, version: 1, updated_at: '2026-09-01T01:00:00Z', registered_at: '2026-04-01T01:00:00Z' }
export const bookResponse = [
  { book_id: 'B-001', title: '吾輩は猫である', author: '夏目漱石', isbn: '9784101010014', publisher: '新潮社', genre_id: 'G-LIT', genre_name: '文学' as Genre, media_type: '紙' as const, current_status: '在庫あり' as BookState, version: 2, updated_at: '2026-09-06T01:00:00Z', registered_at: '2026-04-01T01:00:00Z', reservation_count: 0, my_reservation: null },
  { book_id: 'B-002', title: '銀河鉄道の夜', author: '宮沢賢治', isbn: null, publisher: null, genre_id: 'G-LIT', genre_name: '文学' as Genre, media_type: '紙' as const, current_status: '貸出中' as BookState, version: 3, updated_at: '2026-09-06T01:00:00Z', registered_at: '2026-04-01T01:00:00Z', reservation_count: 1, my_reservation: null },
  { book_id: 'B-003', title: '星をめぐる科学', author: '青山 理子', isbn: null, publisher: '図書館出版', genre_id: 'G-SCI', genre_name: '自然科学' as Genre, media_type: '紙' as const, current_status: '予約待ち' as BookState, version: 1, updated_at: '2026-09-06T01:00:00Z', registered_at: '2026-04-01T01:00:00Z', reservation_count: 2, my_reservation: { reservation_id: 'R-001', queue_position: 2, current_status: '予約中' as const } },
]
export const loanResponse = { page: 1, page_size: 20, total: 2, items: [
  { loan_id: 'L-001', book_id: 'B-001', user_number: 'U-001', loaned_on: '2026-08-01', due_date: '2026-08-15', returned_on: '2026-08-13', current_status: '返却済み' as LoanState, recorded_by: 'S-001', version: 2, updated_at: '2026-08-13T01:00:00Z', book_title: '吾輩は猫である', book_author: '夏目漱石', user_name: '山田 花子' },
  { loan_id: 'L-002', book_id: 'B-002', user_number: 'U-001', loaned_on: '2026-09-01', due_date: '2026-09-15', returned_on: null, current_status: '貸出中' as LoanState, recorded_by: 'S-001', version: 1, updated_at: '2026-09-01T01:00:00Z', book_title: '銀河鉄道の夜', book_author: '宮沢賢治', user_name: '山田 花子' },
] }
export const reservationResponse = { page: 1, page_size: 20, total: 1, items: [
  { reservation_id: 'R-001', book_id: 'B-003', user_number: 'U-001', accepted_at: '2026-09-03T01:00:00Z', queue_position: 2, current_status: '予約中' as '予約中' | '通知済み', version: 1, updated_at: '2026-09-03T01:00:00Z', book_title: '星をめぐる科学', book_author: '青山 理子', user_name: '山田 花子' },
] }
export const toLoan = (l: typeof loanResponse.items[number]): Loan => ({ id: l.loan_id, book: { id: l.book_id, title: l.book_title, author: l.book_author }, userNumber: l.user_number, userName: l.user_name, loanedAt: l.loaned_on, dueDate: l.due_date, returnedAt: l.returned_on ?? undefined, state: l.current_status })
export const toReservation = (r: typeof reservationResponse.items[number]): Reservation => ({ id: r.reservation_id, book: { id: r.book_id, title: r.book_title, author: r.book_author }, userNumber: r.user_number, userName: r.user_name, acceptedAt: r.accepted_at, position: r.queue_position, state: r.current_status })
export const toBook = (b: typeof bookResponse[number]): Book => ({ id: b.book_id, title: b.title, author: b.author, isbn: b.isbn ?? '', publisher: b.publisher ?? '', genre: b.genre_name, media: b.media_type, state: b.current_status, registeredAt: b.registered_at, reservationCount: b.reservation_count })
export const loanEvents = Array.from({ length: 28 }, (_, i) => ({ loan_id: `L-S${i + 1}`, book_id: i < 10 ? 'B-001' : i < 20 ? 'B-002' : 'B-003', loaned_on: `2026-${String(4 + (i % 6)).padStart(2, '0')}-${String(1 + (i % 3)).padStart(2, '0')}` }))
export const initialPeriod = { granularity: '日' as Granularity, from: '2026-09-01', to: today }
export const allPeriod = { granularity: '月' as Granularity, from: '2026-04-01', to: today }
export function rankingResponse(from: string, to: string) {
  const counts = bookResponse.map(b => ({ b, count: loanEvents.filter(l => l.book_id === b.book_id && l.loaned_on >= from && l.loaned_on <= to).length })).filter(x => x.count > 0).sort((a, b) => b.count - a.count || a.b.book_id.localeCompare(b.b.book_id))
  const total = counts.reduce((sum, x) => sum + x.count, 0)
  return counts.map((x, i) => ({ stat_id: `STAT-${x.b.book_id}-${from}-${to}`, period_type: '日' as Granularity, period_start: from, period_end: to, book_id: x.b.book_id, loan_count: x.count, loan_total: total, ranking: 1 + counts.filter(c => c.count > x.count).length, aggregated_at: '2026-09-06T01:00:00Z', book_title: x.b.title, book_author: x.b.author, genre_name: x.b.genre_name }))
}
export function statisticsResponse(granularity: Granularity, from: string, to: string, empty = false) {
  const values = new Map<string, number>()
  for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    const date = d.toISOString().slice(0, 10), key = date.slice(0, granularity === '日' ? 10 : granularity === '月' ? 7 : 4)
    values.set(key, values.get(key) ?? 0)
  }
  if (!empty) for (const event of loanEvents.filter(l => l.loaned_on >= from && l.loaned_on <= to)) {
    const key = event.loaned_on.slice(0, granularity === '日' ? 10 : granularity === '月' ? 7 : 4)
    values.set(key, (values.get(key) ?? 0) + 1)
  }
  const series = [...values].map(([label, value]) => ({ label, value }))
  return { period_type: granularity, period_start: from, period_end: to, total_loans: series.reduce((s, x) => s + x.value, 0), series }
}

// Distinct native entities exercise the second page at the normal 20-row size.
export const pagedBooks: typeof bookResponse = Array.from({ length: 22 }, (_, i) => ({ ...bookResponse[0], book_id: `B-P${String(i + 1).padStart(3, '0')}`, title: `蔵書サンプル ${i + 1}` }))
export const pagedReservations: typeof reservationResponse.items = pagedBooks.map((book, i) => ({ ...reservationResponse.items[0], reservation_id: `R-P${String(i + 1).padStart(3, '0')}`, book_id: book.book_id, book_title: book.title, book_author: book.author, queue_position: 1, accepted_at: `2026-09-${String(6 - Math.floor(i / 4)).padStart(2, '0')}T01:00:00Z` }))
export function pagedRanking(from: string, to: string): ReturnType<typeof rankingResponse> { return pagedBooks.map((b, i) => ({ stat_id: `STAT-${b.book_id}-${from}-${to}`, period_type: '日', period_start: from, period_end: to, book_id: b.book_id, loan_count: 22-i, loan_total: 253, ranking: i+1, aggregated_at: '2026-09-06T01:00:00Z', book_title: b.title, book_author: b.author, genre_name: b.genre_name })) }
