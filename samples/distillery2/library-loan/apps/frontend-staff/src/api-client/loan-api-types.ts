/**
 * 貸出 API (createLoan) の型。
 *
 * 正本: contracts/generated/slices/register-loan/contract-slice.json の components.schemas。
 * packages/contracts/api に生成型・生成クライアントが無いため、生成物が用意されるまでの暫定として
 * 契約のスキーマをそのまま写す (issue: .distillery/runs/register-loan/issues/20260924_130000_frontend-api-client-missing.md)。
 * 生成物ができたらこのファイルを消し、生成型の import に置き換える。
 */

/** 利用者番号 (pattern ^P[0-9]{6}$) */
export type PatronNumber = string;
/** 書籍ID (uuid) */
export type BookId = string;
/** 貸出ID (uuid) */
export type LoanId = string;
/** 予約ID (uuid) */
export type ReservationId = string;

/** 貸出期間 (日数)。契約 LoanPeriodDays の enum */
export type LoanPeriodDays = 7 | 14 | 21;

/** 貸出状態。on_loan=貸出中, overdue=延滞, returned=返却済み */
export type LoanStatus = 'on_loan' | 'overdue' | 'returned';

/** 貸出登録の入力 (CreateLoanRequest) */
export interface CreateLoanRequest {
  patronNumber: PatronNumber;
  bookId: BookId;
}

/** 貸出 (Loan) */
export interface Loan {
  loanId: LoanId;
  bookId: BookId;
  patronNumber: PatronNumber;
  /** 貸出日 (YYYY-MM-DD) */
  loanedOn: string;
  loanPeriodDays: LoanPeriodDays;
  /** 返却期限 (YYYY-MM-DD) */
  dueOn: string;
  status: LoanStatus;
  pickedUpReservationId?: ReservationId | null;
}

/** 入力項目ごとのエラー (FieldError) */
export interface FieldError {
  field: string;
  message: string;
}

/** RFC 9457 Problem Details (Problem / ValidationProblem) */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  /** 業務エラーコード (例 book-on-loan) */
  code?: string;
  /** ValidationProblem (400) のときだけ持つ */
  errors?: FieldError[];
}
