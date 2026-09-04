import React from 'react'
import { PortalShell } from '@/components/ui/PortalShell'
import { ErrorAlert } from './ErrorAlert'

export type StaffGroup = 'counter' | 'books' | 'users' | 'reservations' | 'reports'

/** activeGroup の代表パス（グループ内の activeItem が未知のキーのときのフォールバック） */
const groupFallbackPath: Record<StaffGroup, string> = {
  counter: '/staff/loans/new',
  books: '/staff/books',
  users: '/staff/users',
  reservations: '/staff/overdues',
  reports: '/staff/reports/inventory',
}

/** グループ内の activeItem キー → PortalShell のナビ href（既知の代表項目） */
const itemPath: Record<StaffGroup, Record<string, string>> = {
  counter: { loanRegister: '/staff/loans/new', returnRegister: '/staff/returns/new', search: '/staff/search' },
  books: { bookList: '/staff/books', bookNew: '/staff/books/new', bookEdit: '/staff/books', bookDelete: '/staff/books' },
  users: { userList: '/staff/users', userNew: '/staff/users/new', userEdit: '/staff/users', userDelete: '/staff/users', userStatus: '/staff/users/status' },
  reservations: { reservationList: '/staff/books/reservations', overdues: '/staff/overdues', returnNotify: '/staff/overdues' },
  reports: { inventory: '/staff/reports/inventory', ranking: '/staff/reports/ranking', loanStats: '/staff/reports/loans' },
}

export interface StaffLayoutProps {
  activeGroup: StaffGroup
  /** グループ内のアクティブ項目キー（例: 'loanRegister', 'bookList', 'overdues', 'inventory'） */
  activeItem: string
  /** Storybook 等で認証・司書判定を注入する。実アプリでは認証セッションから決定する */
  isAuthenticated?: boolean
  isLibrarian?: boolean
  userName?: string
  children: React.ReactNode
}

/**
 * 司書ポータル全画面の外枠。PortalShell（staff / staff-collapsed）にサイドバーのアクティブ判定・認証 + 司書区分ガードを付与する。
 * 全画面で認証 + 利用者区分「司書」を要求する。未認証は IdP へ、司書以外は 403 相当の ErrorAlert を main に表示する。
 */
export const StaffLayout: React.FC<StaffLayoutProps> = ({ activeGroup, activeItem, isAuthenticated = true, isLibrarian = true, userName = '司書', children }) => {
  const currentPath = itemPath[activeGroup][activeItem] ?? groupFallbackPath[activeGroup]

  if (!isAuthenticated) {
    return (
      <PortalShell portal="staff" currentPath={currentPath} userName={userName}>
        <ErrorAlert error={{ kind: 'unauthorized', message: 'ログインが必要です' }} />
      </PortalShell>
    )
  }

  if (!isLibrarian) {
    return (
      <PortalShell portal="staff" currentPath={currentPath} userName={userName}>
        <ErrorAlert error={{ kind: 'forbidden', message: 'この画面を表示する権限がありません' }} />
      </PortalShell>
    )
  }

  return (
    <PortalShell portal="staff" currentPath={currentPath} userName={userName}>
      {children}
    </PortalShell>
  )
}
