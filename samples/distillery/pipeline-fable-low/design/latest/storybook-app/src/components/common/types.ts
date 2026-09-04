/** api client が正規化する統一エラー型（HTTP ステータス→種別のマッピングは呼び出し側で行う） */
export type NormalizedApiErrorKind = 'unauthorized' | 'forbidden' | 'notFound' | 'validation' | 'conflict' | 'business' | 'server' | 'network'

export interface NormalizedApiError {
  kind: NormalizedApiErrorKind
  message: string
  reasonCode?: string
  fieldErrors?: Record<string, string>
}

/** AsyncStateView / PaginatedListFrame / ConfirmPage 等で共有する EmptyState の内容 */
export interface EmptyStateContent {
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

/** AsyncStateView の Skeleton 指定 */
export interface SkeletonSpec {
  variant: 'line' | 'table' | 'card'
  count?: number
}
