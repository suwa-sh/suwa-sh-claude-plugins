import React from 'react'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from './PageHeader'
import { AsyncStateView } from './AsyncStateView'
import { ErrorAlert } from './ErrorAlert'
import { SubmitButton } from './SubmitButton'
import type { EmptyStateContent, NormalizedApiError } from './types'

export interface ConfirmPageDoneAction {
  label: string
  onClick: () => void
  variant?: 'default' | 'secondary'
}

export interface ConfirmPageProps {
  title: string
  /** 削除・取消は destructive、送信・予約申込は primary */
  tone: 'destructive' | 'primary'
  /** 実行不可（貸出中のため削除不可 等）。true のとき確定ボタン非表示、impact に根拠 */
  blocked: boolean
  /** 対象の要約（Badge / PiiMaskedText / ReservationQueueTracker を含めてよい） */
  summary: React.ReactNode
  impact: string
  /** 補助情報（S-返却通知の ReservationTable / CollapsibleSection(NotificationLogTable)） */
  supplement?: React.ReactNode
  loading: boolean
  loadError: NormalizedApiError | null
  emptyState: EmptyStateContent
  submitting: boolean
  submitError?: NormalizedApiError | null
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  doneActions?: ConfirmPageDoneAction[]
}

/**
 * ConfirmPanel 相当の確認画面の共通シェル。
 * 対象の取得、blocked 判定、確定送信、確定後の完了導線を統一する。
 * ConfirmPanel の variant は tone と blocked から導出する（blocked=true → 'blocked' 相当の表示）。
 * 確定後の履歴 replace は呼び出し側（useNoticeNavigation）が行う。
 */
export const ConfirmPage: React.FC<ConfirmPageProps> = ({
  title,
  tone,
  blocked,
  summary,
  impact,
  supplement,
  loading,
  loadError,
  emptyState,
  submitting,
  submitError,
  confirmLabel,
  onConfirm,
  onCancel,
  doneActions,
}) => (
  <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
    <PageHeader title={title} back={{ label: '戻る', onClick: onCancel }} />
    <div className="mx-auto w-full" style={{ maxWidth: '40rem' }}>
      <AsyncStateView loading={loading} error={loadError} empty={false} skeleton={{ variant: 'card' }} emptyState={emptyState}>
        <Card>
          <div className="flex items-start" style={{ gap: 'var(--spacing-3)' }}>
            <span style={{ color: tone === 'destructive' ? 'var(--destructive)' : 'var(--primary)', marginTop: 2 }}>
              <Icon name={tone === 'destructive' ? 'alert-triangle' : 'info'} size={24} />
            </span>
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>{title}</h2>
          </div>
          <div className="border-y" style={{ marginBlock: 'var(--spacing-4)', paddingBlock: 'var(--spacing-4)', borderColor: 'var(--border)' }}>
            {summary}
          </div>
          {blocked ? (
            <Alert tone="destructive" title="この操作は実行できません">
              {impact}
            </Alert>
          ) : (
            <Alert tone={tone === 'destructive' ? 'warning' : 'info'}>{impact}</Alert>
          )}
          {submitError && submitError.kind === 'business' ? (
            <div style={{ marginTop: 'var(--spacing-3)' }}>
              <ErrorAlert error={submitError} />
            </div>
          ) : null}
          {submitError && (submitError.kind === 'server' || submitError.kind === 'network') ? (
            <div style={{ marginTop: 'var(--spacing-3)' }}>
              <ErrorAlert error={submitError} onRetry={onConfirm} />
            </div>
          ) : null}
          {supplement ? <div style={{ marginTop: 'var(--spacing-4)' }}>{supplement}</div> : null}
          <div className="flex flex-wrap justify-end" style={{ gap: 'var(--spacing-2)', marginTop: 'var(--spacing-6)' }}>
            <Button variant="outline" icon="arrow-left" onClick={onCancel} disabled={submitting}>
              戻る
            </Button>
            {!blocked ? <SubmitButton label={confirmLabel} submitting={submitting} variant={tone === 'destructive' ? 'destructive' : 'default'} type="button" onClick={onConfirm} /> : null}
          </div>
          {doneActions && doneActions.length > 0 ? (
            <div className="flex flex-wrap items-center" style={{ gap: 'var(--spacing-2)', marginTop: 'var(--spacing-4)' }}>
              {doneActions.map((action) => (
                <Button key={action.label} variant={action.variant ?? 'default'} onClick={action.onClick}>
                  {action.label}
                </Button>
              ))}
            </div>
          ) : null}
        </Card>
      </AsyncStateView>
    </div>
  </div>
)
