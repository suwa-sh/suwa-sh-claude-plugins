import React from 'react'
import { Alert } from '../ui/Feedback'
import { Button } from '../ui/Button'
import { Card, CardHeader } from '../ui/Card'
import { Icon } from '../ui/Icon'
import { Input } from '../ui/Input'
import { DueDateIndicator } from './DueDateIndicator'
import { BookStatusBadge, LoanStatusBadge } from './StatusBadges'
import { formatDate, type Book, type Loan, type Reservation, type User } from './types'

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between" style={{ gap: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}>
    <span style={{ color: 'var(--foreground-secondary)' }}>{label}</span>
    <span className="text-right">{children}</span>
  </div>
)

/* ---------- LoanRegisterPanel ---------- */
export interface LoanLookup {
  user?: User
  book?: Book
  /** 貸出可否判定（条件「貸出可否判定」） */
  allowed?: boolean
  deniedReason?: string
  /** 返却期限算出（条件「返却期限算出」） */
  dueDate?: string
  loanPeriodDays?: number
}

export interface LoanRegisterPanelProps {
  userNumber: string
  bookId: string
  onUserNumberChange: (v: string) => void
  onBookIdChange: (v: string) => void
  onLookup: () => void
  lookup?: LoanLookup
  today: string
  phase: 'input' | 'allowed' | 'denied' | 'done'
  submitting?: boolean
  onConfirm: () => void
  onReset: () => void
}

/** 貸出受付: 左=入力 6col / 右=判定結果 6col。最少操作（SP-006）+ 確認 + 二重送信防止（SR-005） */
export const LoanRegisterPanel: React.FC<LoanRegisterPanelProps> = ({ userNumber, bookId, onUserNumberChange, onBookIdChange, onLookup, lookup, today, phase, submitting, onConfirm, onReset }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'var(--section-gap)' }}>
    <Card>
      <CardHeader title="貸出情報の入力" description="利用者番号と書籍 ID を入力して確認します" />
      <form
        className="flex flex-col"
        style={{ gap: 'var(--component-gap)' }}
        onSubmit={(e) => {
          e.preventDefault()
          onLookup()
        }}
      >
        <Input label="利用者番号" icon="id-card" mono required value={userNumber} onChange={(e) => onUserNumberChange(e.target.value)} placeholder="U-000123" disabled={phase === 'done'} autoFocus />
        <Input label="書籍 ID" icon="book" mono required value={bookId} onChange={(e) => onBookIdChange(e.target.value)} placeholder="B-000101" disabled={phase === 'done'} />
        <div className="flex" style={{ gap: 'var(--spacing-2)' }}>
          <Button type="submit" icon="search" disabled={phase === 'done'}>
            確認する
          </Button>
          <Button variant="ghost" icon="rotate-ccw" onClick={onReset}>
            クリア
          </Button>
        </div>
      </form>
    </Card>
    <Card>
      <CardHeader title="判定結果" />
      {phase === 'input' ? (
        <p style={{ color: 'var(--foreground-muted)', fontSize: 'var(--font-size-sm)' }}>利用者番号と書籍 ID を入力して「確認する」を押してください</p>
      ) : null}
      {phase !== 'input' && lookup ? (
        <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
          {phase === 'denied' ? (
            <Alert tone="destructive" title="貸出できません">{lookup.deniedReason}</Alert>
          ) : phase === 'done' ? (
            <Alert tone="success" title="貸出を登録しました">返却期限 {lookup.dueDate ? formatDate(lookup.dueDate) : ''} を利用者に案内してください</Alert>
          ) : (
            <Alert tone="info" title="貸出できます">内容を確認して「貸出を確定する」を押してください</Alert>
          )}
          <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
            <Row label="利用者">{lookup.user ? `${lookup.user.name} (${lookup.user.number})` : '見つかりません'}</Row>
            <Row label="書籍">{lookup.book ? lookup.book.title : '見つかりません'}</Row>
            {lookup.book ? (
              <Row label="書籍の状態">
                <BookStatusBadge state={phase === 'done' ? '貸出中' : lookup.book.state} />
              </Row>
            ) : null}
            {lookup.dueDate ? (
              <Row label={`返却期限（貸出期間 ${lookup.loanPeriodDays ?? 14} 日）`}>
                <DueDateIndicator dueDate={lookup.dueDate} today={today} remindDays={0} />
              </Row>
            ) : null}
          </div>
          {phase === 'allowed' ? (
            <Button icon="check" loading={submitting} onClick={onConfirm} size="lg">
              貸出を確定する
            </Button>
          ) : null}
          {phase === 'done' ? (
            <Button variant="outline" icon="plus" onClick={onReset}>
              次の貸出を受け付ける
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  </div>
)

/* ---------- ReturnRegisterPanel ---------- */
export interface ReturnLookup {
  loan?: Loan
  book?: Book
  /** 返却後の書籍状態判定（条件「返却後の書籍状態判定」） */
  nextBookState?: '在庫あり' | '予約待ち'
  firstReservation?: Reservation
}

export interface ReturnRegisterPanelProps {
  bookId: string
  onBookIdChange: (v: string) => void
  onLookup: () => void
  lookup?: ReturnLookup
  today: string
  phase: 'input' | 'found' | 'found-with-reservation' | 'done'
  submitting?: boolean
  onConfirm: () => void
  onReset: () => void
  onNotify?: () => void
}

export const ReturnRegisterPanel: React.FC<ReturnRegisterPanelProps> = ({ bookId, onBookIdChange, onLookup, lookup, today, phase, submitting, onConfirm, onReset, onNotify }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'var(--section-gap)' }}>
    <Card>
      <CardHeader title="返却書籍の入力" description="書籍 ID から貸出記録を特定します" />
      <form
        className="flex flex-col"
        style={{ gap: 'var(--component-gap)' }}
        onSubmit={(e) => {
          e.preventDefault()
          onLookup()
        }}
      >
        <Input label="書籍 ID" icon="book" mono required value={bookId} onChange={(e) => onBookIdChange(e.target.value)} placeholder="B-000102" disabled={phase === 'done'} autoFocus />
        <div className="flex" style={{ gap: 'var(--spacing-2)' }}>
          <Button type="submit" icon="search" disabled={phase === 'done'}>
            確認する
          </Button>
          <Button variant="ghost" icon="rotate-ccw" onClick={onReset}>
            クリア
          </Button>
        </div>
      </form>
    </Card>
    <Card>
      <CardHeader title="返却内容" />
      {phase === 'input' ? <p style={{ color: 'var(--foreground-muted)', fontSize: 'var(--font-size-sm)' }}>書籍 ID を入力して「確認する」を押してください</p> : null}
      {phase !== 'input' && lookup?.loan ? (
        <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
          {phase === 'done' ? (
            <Alert
              tone="success"
              title="返却を登録しました"
              action={
                lookup.nextBookState === '予約待ち' && onNotify ? (
                  <Button size="sm" icon="mail" onClick={onNotify}>
                    返却通知を送る
                  </Button>
                ) : undefined
              }
            >
              書籍の状態は「{lookup.nextBookState}」になりました
            </Alert>
          ) : phase === 'found-with-reservation' ? (
            <Alert tone="warning" title="予約者がいます">
              返却後は「予約待ち」になり、予約順位 1 位の {lookup.firstReservation?.userName} さんへ返却通知を送信します
            </Alert>
          ) : (
            <Alert tone="info" title="返却できます">予約はありません。返却後は「在庫あり」に戻ります</Alert>
          )}
          <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
            <Row label="書籍">{lookup.loan.book.title}</Row>
            <Row label="利用者">{lookup.loan.userName} ({lookup.loan.userNumber})</Row>
            <Row label="貸出日">{formatDate(lookup.loan.loanedAt)}</Row>
            <Row label="返却期限">
              <DueDateIndicator dueDate={lookup.loan.dueDate} today={today} returned={phase === 'done'} />
            </Row>
            <Row label="貸出の状態">
              <LoanStatusBadge state={phase === 'done' ? '返却済み' : lookup.loan.state} />
            </Row>
            <Row label="返却後の書籍状態">
              <span className="inline-flex items-center" style={{ gap: 'var(--spacing-1)' }}>
                <BookStatusBadge state="貸出中" />
                <Icon name="arrow-right" size={14} />
                <BookStatusBadge state={lookup.nextBookState ?? '在庫あり'} />
              </span>
            </Row>
          </div>
          {phase !== 'done' ? (
            <Button icon="check" loading={submitting} onClick={onConfirm} size="lg">
              返却を確定する
            </Button>
          ) : (
            <Button variant="outline" icon="plus" onClick={onReset}>
              次の返却を受け付ける
            </Button>
          )}
        </div>
      ) : null}
      {phase !== 'input' && !lookup?.loan ? <Alert tone="destructive" title="貸出記録が見つかりません">書籍 ID を確認してください。在庫ありの書籍は返却できません</Alert> : null}
    </Card>
  </div>
)

/* ---------- ConfirmPanel ---------- */
export interface ConfirmPanelProps {
  title: string
  description?: string
  /** 対象の要約（ラベルと値） */
  summary: { label: string; value: React.ReactNode }[]
  /** 影響・注意（例: 貸出中のため削除できません） */
  impact?: React.ReactNode
  tone?: 'destructive' | 'primary'
  /** 実行不可（条件違反）。確定ボタンを出さない */
  blocked?: boolean
  blockedReason?: string
  confirmLabel?: string
  cancelLabel?: string
  submitting?: boolean
  onConfirm?: () => void
  onCancel?: () => void
}

/** 削除 / 取消 / 送信の確認画面（RDRA 確認画面 4 件、SR-005） */
export const ConfirmPanel: React.FC<ConfirmPanelProps> = ({ title, description, summary, impact, tone = 'primary', blocked, blockedReason, confirmLabel = '確定する', cancelLabel = '戻る', submitting, onConfirm, onCancel }) => (
  <Card style={{ maxWidth: '40rem' }}>
    <div className="flex items-start" style={{ gap: 'var(--spacing-3)' }}>
      <span style={{ color: tone === 'destructive' ? 'var(--destructive)' : 'var(--primary)', marginTop: 2 }}>
        <Icon name={tone === 'destructive' ? 'alert-triangle' : 'info'} size={24} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>{title}</h2>
        {description ? <p style={{ color: 'var(--foreground-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-1)' }}>{description}</p> : null}
      </div>
    </div>
    <dl className="flex flex-col border-y" style={{ gap: 'var(--spacing-2)', marginBlock: 'var(--spacing-4)', paddingBlock: 'var(--spacing-4)', borderColor: 'var(--border)' }}>
      {summary.map((s) => (
        <div key={s.label} className="flex items-center justify-between" style={{ gap: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}>
          <dt style={{ color: 'var(--foreground-secondary)' }}>{s.label}</dt>
          <dd className="text-right">{s.value}</dd>
        </div>
      ))}
    </dl>
    {blocked ? (
      <Alert tone="destructive" title="この操作は実行できません">{blockedReason}</Alert>
    ) : impact ? (
      <Alert tone={tone === 'destructive' ? 'warning' : 'info'}>{impact}</Alert>
    ) : null}
    <div className="flex justify-end" style={{ gap: 'var(--spacing-2)', marginTop: 'var(--spacing-6)' }}>
      <Button variant="outline" icon="arrow-left" onClick={onCancel} disabled={submitting}>
        {cancelLabel}
      </Button>
      {!blocked ? (
        <Button variant={tone === 'destructive' ? 'destructive' : 'default'} loading={submitting} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      ) : null}
    </div>
  </Card>
)
