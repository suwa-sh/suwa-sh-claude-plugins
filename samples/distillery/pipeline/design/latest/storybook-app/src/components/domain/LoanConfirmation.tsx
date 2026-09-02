import React from 'react'
import { Alert } from '../ui/Feedback'
import { Button } from '../ui/Button'
import { daysUntil, formatDateLong, formatRemaining } from '../common/dateFormat'

/**
 * `POST /api/v1/loans` の応答（`_cross-cutting/api/openapi.yaml` の `LoanResponse` と同一の形）。
 * 画面側で別名の再定義をしない。
 */
export interface LoanResponse {
  loan_id: string
  book_id: string
  user_no: string
  loan_date: string
  loan_period_type: string
  due_date: string
  loan_status: string
  book_status: string
}

export interface LoanConfirmationProps {
  /** 貸出登録の確定結果。`null` の間は何も描画しない */
  result: LoanResponse | null
  /** 次の行動導線（続けて貸し出す）を親へ通知する。汎用名 onLoan / onDone は使わない */
  onLoanSucceeded: (result: LoanResponse) => void
  /** 残日数の算出基準日（ISO）。既定は当日 */
  today?: string
}

/**
 * 窓口貸出受付画面の完了表示（表示専用。結果を自前の state に写さない）。
 * `result.loan_id` と `result.due_date`（`YYYY年M月D日` へ整形）・残日数（`あと{N}日`）を表示し、
 * 次の行動導線を 1 つだけ提示する（ピーク・エンドの法則）。
 */
export const LoanConfirmation: React.FC<LoanConfirmationProps> = ({ result, onLoanSucceeded, today }) => {
  if (result === null) return null

  const baseDate = today ?? result.due_date
  const remaining = daysUntil(result.due_date, baseDate)

  return (
    <Alert tone="success" title={`貸出ID ${result.loan_id} を登録しました`}>
      返却期限は {formatDateLong(result.due_date)}（{formatRemaining(remaining, 'return')}）です。
      <div style={{ marginTop: 'var(--spacing-2)' }}>
        <Button variant="outline" size="sm" onClick={() => onLoanSucceeded(result)}>
          続けて貸し出す
        </Button>
      </div>
    </Alert>
  )
}
