import React, { useState } from 'react'
import { Button } from '../ui/Button'
import { Card, CardHeader } from '../ui/Card'
import { Icon } from '../ui/Icon'
import { UserStatusBadge } from './StatusBadges'
import type { UserState } from './stateMaps'
import { formatDateLong } from '../common/dateFormat'

export interface UserProfileCardUser {
  userNumber: string
  name: string
  email: string
  category: string
  state: UserState
  registeredAt: string
}

export interface UserProfileCardProps {
  user: UserProfileCardUser
  /** 既定 true。NFR E.1.2.1 / arch SR-006（個人情報表示の最小化） */
  maskContact?: boolean
  actions?: React.ReactNode
}

/** t****@example.jp 形式にマスクする（先頭 1 文字とドメインのみ残す） */
export function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return '****'
  return `${email.slice(0, 1)}****${email.slice(at)}`
}

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--foreground-muted)',
}

const valueStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--foreground)',
}

/**
 * マイページ登録内容画面・利用者情報変更画面・退会手続画面で使う利用者情報カード。
 * メールアドレスは既定でマスクし、明示操作でのみ開示する（NFR E.1.2.1 / arch SR-006）。
 */
export const UserProfileCard: React.FC<UserProfileCardProps> = ({
  user,
  maskContact = true,
  actions,
}) => {
  const [revealed, setRevealed] = useState(!maskContact)
  const showMasked = maskContact && !revealed

  return (
    <Card>
      <CardHeader
        title={user.name}
        description={`利用者区分: ${user.category}`}
        actions={<UserStatusBadge state={user.state} dot />}
      />
      <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
        <div className="flex flex-col" style={{ gap: 'var(--spacing-1)' }}>
          <span style={labelStyle}>利用者番号</span>
          <span
            style={{
              fontFamily: 'var(--font-family-mono)',
              fontVariantNumeric: 'tabular-nums',
              fontSize: 'var(--font-size-xl)',
              fontWeight: 600,
              color: 'var(--foreground)',
              letterSpacing: '0.04em',
            }}
          >
            {user.userNumber}
          </span>
        </div>

        <div className="flex flex-col" style={{ gap: 'var(--spacing-1)' }}>
          <span style={labelStyle}>メールアドレス</span>
          <div className="flex flex-wrap items-center" style={{ gap: 'var(--spacing-2)' }}>
            {showMasked ? (
              <span
                className="inline-flex items-center"
                style={{
                  gap: 'var(--spacing-1)',
                  background: 'var(--pii-mask-bg)',
                  color: 'var(--pii-mask-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-1) var(--spacing-2)',
                  fontFamily: 'var(--font-family-mono)',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                <Icon name="shield-check" size={14} label="個人情報保護のためマスク表示中" />
                {maskEmail(user.email)}
              </span>
            ) : (
              <span
                style={{
                  fontFamily: 'var(--font-family-mono)',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--foreground)',
                }}
              >
                {user.email}
              </span>
            )}
            {maskContact && (
              <Button
                variant="ghost"
                size="sm"
                iconLeft={revealed ? 'eye-off' : 'eye'}
                aria-pressed={revealed}
                onClick={() => setRevealed((v) => !v)}
              >
                {revealed ? '隠す' : '表示する'}
              </Button>
            )}
          </div>
          {showMasked && (
            <span style={labelStyle}>
              個人情報保護のため一部を伏せています。必要なときだけ表示してください。
            </span>
          )}
        </div>

        <div className="flex flex-col" style={{ gap: 'var(--spacing-1)' }}>
          <span style={labelStyle}>登録日</span>
          <span
            style={{
              ...valueStyle,
              fontFamily: 'var(--font-family-mono)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatDateLong(user.registeredAt)}
          </span>
        </div>

        {actions && (
          <div className="flex flex-wrap items-center" style={{ gap: 'var(--spacing-2)' }}>
            {actions}
          </div>
        )}
      </div>
    </Card>
  )
}
