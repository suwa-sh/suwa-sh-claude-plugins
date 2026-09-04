import React from 'react'
import { PageHeader } from './PageHeader'
import { AsyncStateView } from './AsyncStateView'
import { ErrorAlert } from './ErrorAlert'
import type { NormalizedApiError } from './types'

export interface EntityFormPageProps {
  mode: 'create' | 'edit'
  title: string
  status?: React.ReactNode
  loading?: boolean
  loadError?: NormalizedApiError | null
  submitError?: NormalizedApiError | null
  submitting: boolean
  onReload?: () => void
  onCancel: () => void
  children: (ctx: { fieldErrors: Record<string, string> }) => React.ReactNode
}

/**
 * BookForm / UserForm を置く登録・編集画面の共通シェル。
 * 読み込み（編集時）、422 フィールドエラーの引き渡し、409 競合、送信中の遷移ブロック、完了後の一覧復帰を統一する。
 */
export const EntityFormPage: React.FC<EntityFormPageProps> = ({ title, status, loading = false, loadError = null, submitError = null, submitting, onReload, onCancel, children }) => {
  const fieldErrors = submitError?.kind === 'validation' ? (submitError.fieldErrors ?? {}) : {}
  const showConflict = submitError?.kind === 'conflict'
  const showOtherSubmitError = submitError && submitError.kind !== 'validation' && submitError.kind !== 'conflict'

  return (
    <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
      <PageHeader
        title={title}
        status={status}
        back={{ label: '一覧へ戻る', onClick: onCancel }}
        notices={
          <>
            {showConflict ? <ErrorAlert error={submitError!} onReload={onReload} /> : null}
            {showOtherSubmitError ? <ErrorAlert error={submitError!} /> : null}
          </>
        }
      />
      <div className="mx-auto w-full" style={{ maxWidth: '48rem' }} aria-busy={submitting || undefined}>
        <AsyncStateView
          loading={loading}
          error={loadError}
          empty={false}
          skeleton={{ variant: 'line', count: 6 }}
          emptyState={{ title: '対象が見つかりません', action: { label: '一覧へ戻る', onClick: onCancel } }}
        >
          {children({ fieldErrors })}
        </AsyncStateView>
      </div>
    </div>
  )
}
