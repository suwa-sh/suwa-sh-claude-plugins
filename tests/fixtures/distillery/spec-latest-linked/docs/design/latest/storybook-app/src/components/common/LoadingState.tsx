import React from 'react'
import {
  Skeleton,
  SkeletonCard,
  SkeletonDetail,
  SkeletonTable,
  Spinner,
} from '@/components/ui/Feedback'

/**
 * 待ちの種類。ここに無い loading 表現を画面側で作ってはならない。
 *
 * | kind   | 表現              | 使う場面 |
 * |--------|-------------------|----------|
 * | list   | SkeletonTable     | 一覧の初回取得・再取得（行と列の形が決まっている） |
 * | card   | SkeletonCard      | カード一覧（検索結果・KPI）の取得 |
 * | detail | SkeletonDetail    | 詳細・定義リストの取得 |
 * | line   | Skeleton          | 見出し・1 行のテキストだけの取得 |
 * | action | Spinner(inline)   | 操作起点の短い待ち（検索実行・再送・再試行）。レイアウトは変わらない |
 * | page   | Spinner(overlay)  | 画面全体をブロックする待ち（遷移直後・確定処理） |
 */
export type LoadingKind = 'list' | 'card' | 'detail' | 'line' | 'action' | 'page'

export interface LoadingStateProps {
  kind?: LoadingKind
  /** スクリーンリーダーへ読ませる待ちの内容 */
  label?: string
  /**
   * ちらつき防止の遅延表示（ms）。既定 0 = 即時表示。
   * Story・E2E が t=0 で状態を観測できるよう既定は 0 にし、
   * 高速に返る領域だけ画面側で `delayMs={300}` を指定する。
   */
  delayMs?: number
  /** kind='list' の行数 / kind='detail' の項目数 / kind='card' の枚数 */
  rows?: number
  /** kind='list' の列数 */
  cols?: number
}

/**
 * loading 表現の唯一の入口（CR-d0f57ea2-006）。
 *
 * - Skeleton と Spinner の使い分けはこのコンポーネントだけが決める。
 * - 同一領域で Skeleton と Spinner を同時に出さない。
 * - 常に `aria-busy` + `role="status"` を伴い、視覚に依らず待ちを伝える。
 * - ちらつきが問題になる領域だけ `delayMs`（推奨 300ms）で遅延表示する（NFR B.2.1.1 / F.3.1.2）。
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  kind = 'list',
  label = '読み込み中',
  delayMs = 0,
  rows,
  cols,
}) => {
  const [visible, setVisible] = React.useState(delayMs <= 0)

  React.useEffect(() => {
    if (delayMs <= 0) {
      setVisible(true)
      return
    }
    setVisible(false)
    const timer = window.setTimeout(() => setVisible(true), delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs, kind])

  if (!visible) return null

  if (kind === 'action') return <Spinner size="sm" variant="inline" label={label} />
  if (kind === 'page') return <Spinner size="lg" variant="overlay" label={label} />

  return (
    <div aria-busy="true" role="status" aria-live="polite">
      <span className="ds-sr-only">{label}</span>
      {kind === 'list' && <SkeletonTable rows={rows ?? 5} cols={cols ?? 4} />}
      {kind === 'card' && <SkeletonCard count={rows ?? 3} />}
      {kind === 'detail' && <SkeletonDetail rows={rows ?? 6} />}
      {kind === 'line' && <Skeleton height="1.25rem" />}
    </div>
  )
}
