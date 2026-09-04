import type { Book, Loan, NotificationLog, Reservation, User } from './types'

export const TODAY = '2026-09-03'

export const sampleBooks: Book[] = [
  { id: 'B-000101', title: '吾輩は猫である', author: '夏目漱石', isbn: '9784101010014', publisher: '新潮社', genre: '文学', media: '紙', state: '在庫あり', registeredAt: '2026-04-01' },
  { id: 'B-000102', title: 'リーダブルコード', author: 'Dustin Boswell', isbn: '9784873115658', publisher: 'オライリー・ジャパン', genre: '技術', media: '紙', state: '貸出中', registeredAt: '2026-04-02', reservationCount: 2 },
  { id: 'B-000103', title: 'サピエンス全史（上）', author: 'ユヴァル・ノア・ハラリ', isbn: '9784309226712', publisher: '河出書房新社', genre: '歴史', media: '紙', state: '予約待ち', registeredAt: '2026-04-05', reservationCount: 1 },
  { id: 'B-000104', title: 'ぐりとぐら', author: '中川李枝子', isbn: '9784834000825', publisher: '福音館書店', genre: '児童書', media: '紙', state: '在庫あり', registeredAt: '2026-04-10' },
  { id: 'B-000105', title: '銀河鉄道の夜', author: '宮沢賢治', isbn: '9784101092058', publisher: '新潮社', genre: '文学', media: '紙', state: '貸出中', registeredAt: '2026-04-12' },
  { id: 'B-000106', title: '世界の名画 100 選', author: '高階秀爾', isbn: '9784058002100', publisher: '学研', genre: '芸術', media: '紙', state: '在庫あり', registeredAt: '2026-05-01' },
]

export const sampleUsers: User[] = [
  { number: 'U-000123', name: '山田 花子', email: 'hanako.yamada@example.com', phone: '090-1234-5678', address: '東京都千代田区一ツ橋 1-1-1', registeredAt: '2026-04-15' },
  { number: 'U-000124', name: '佐藤 太郎', email: 'taro.sato@example.com', phone: '080-2345-6789', address: '東京都千代田区神田神保町 2-2-2', registeredAt: '2026-05-02' },
  { number: 'U-000125', name: '鈴木 一郎', email: 'ichiro.suzuki@example.com', phone: '070-3456-7890', address: '東京都文京区本郷 3-3-3', registeredAt: '2026-06-20' },
]

export const sampleLoans: Loan[] = [
  { id: 'L-002001', book: sampleBooks[1], userNumber: 'U-000123', userName: '山田 花子', loanedAt: '2026-08-25', dueDate: '2026-09-08', state: '貸出中' },
  { id: 'L-002002', book: sampleBooks[4], userNumber: 'U-000123', userName: '山田 花子', loanedAt: '2026-08-20', dueDate: '2026-09-05', state: '貸出中' },
  { id: 'L-001990', book: sampleBooks[0], userNumber: 'U-000124', userName: '佐藤 太郎', loanedAt: '2026-08-10', dueDate: '2026-08-24', state: '延滞' },
  { id: 'L-001950', book: sampleBooks[3], userNumber: 'U-000123', userName: '山田 花子', loanedAt: '2026-07-01', dueDate: '2026-07-15', returnedAt: '2026-07-12', state: '返却済み' },
]

export const sampleReservations: Reservation[] = [
  { id: 'R-003001', book: sampleBooks[1], userNumber: 'U-000124', userName: '佐藤 太郎', acceptedAt: '2026-08-26T10:12:00', position: 1, state: '予約中' },
  { id: 'R-003002', book: sampleBooks[1], userNumber: 'U-000125', userName: '鈴木 一郎', acceptedAt: '2026-08-28T15:40:00', position: 2, state: '予約中' },
  { id: 'R-002990', book: sampleBooks[2], userNumber: 'U-000123', userName: '山田 花子', acceptedAt: '2026-08-15T09:00:00', position: 1, state: '通知済み' },
  { id: 'R-002980', book: sampleBooks[4], userNumber: 'U-000123', userName: '山田 花子', acceptedAt: '2026-08-01T11:30:00', position: 1, state: '取消' },
]

export const sampleNotifications: NotificationLog[] = [
  { id: 'N-004001', kind: '督促', to: 'taro.sato@example.com', subject: '【図書館】返却期限を過ぎています', sentAt: '2026-09-03T06:00:00', result: '成功' },
  { id: 'N-004000', kind: 'リマインド', to: 'hanako.yamada@example.com', subject: '【図書館】返却期限が近づいています', sentAt: '2026-09-02T06:00:00', result: '成功' },
  { id: 'N-003990', kind: '返却通知', to: 'hanako.yamada@example.com', subject: '【図書館】予約された書籍が返却されました', sentAt: '2026-08-30T14:05:00', result: '失敗' },
]

export const sampleRanking = [
  { rank: 1, book: sampleBooks[1], count: 42 },
  { rank: 2, book: sampleBooks[2], count: 37 },
  { rank: 3, book: sampleBooks[0], count: 29 },
  { rank: 4, book: sampleBooks[4], count: 21 },
  { rank: 5, book: sampleBooks[3], count: 18 },
]

export const sampleMonthlySeries = [
  { label: '2026/04', value: 312 },
  { label: '2026/05', value: 358 },
  { label: '2026/06', value: 297 },
  { label: '2026/07', value: 401 },
  { label: '2026/08', value: 436 },
  { label: '2026/09', value: 58 },
]
