import React from 'react'
import { PortalShell } from '@/components/ui/PortalShell'
import { ErrorAlert } from './ErrorAlert'

export type PatronNav = 'search' | 'myLoans' | 'myReservations'

const navPath: Record<PatronNav, string> = {
  search: '/search',
  myLoans: '/me/loans',
  myReservations: '/me/reservations',
}

export interface PatronLayoutProps {
  activeNav: PatronNav
  /** true のとき未認証なら IdP ログインへ遷移し、ログイン後に元 URL へ戻す（既定 false） */
  requireAuth?: boolean
  /** Storybook 等で認証済み扱いにするための注入。実アプリでは認証セッションから決定する */
  isAuthenticated?: boolean
  userName?: string
  children: React.ReactNode
}

/**
 * 利用者ポータル全画面の外枠。PortalShell（patron）にトップナビのアクティブ判定・認証ガードを付与する。
 * 司書向け導線を一切出さない（design nfr_decisions E.5.3.1）。
 */
export const PatronLayout: React.FC<PatronLayoutProps> = ({ activeNav, requireAuth = false, isAuthenticated = true, userName, children }) => {
  if (requireAuth && !isAuthenticated) {
    return (
      <PortalShell portal="patron" currentPath={navPath[activeNav]} userName={userName}>
        <ErrorAlert error={{ kind: 'unauthorized', message: 'ログインが必要です' }} />
      </PortalShell>
    )
  }

  return (
    <PortalShell portal="patron" currentPath={navPath[activeNav]} userName={userName}>
      {children}
    </PortalShell>
  )
}
