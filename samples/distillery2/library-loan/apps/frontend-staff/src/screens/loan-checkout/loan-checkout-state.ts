/**
 * 貸出受付画面 (LoanCheckout, route /staff/loans/new) の画面状態。
 *
 * 画面の構造の正は packages/ui/stories/LoanCheckout.stories.tsx。variant は story の 4 つ
 * (default / completed / notLendable / error) に合わせ、各 variant で story が部品へ渡す値を組み立てる。
 * 部品 (StaffLayout / PageHeader / CounterLookup / Card / Alert / BookInfoPanel / DueDateDisplay) の描画は
 * packages/ui の部品に任せ、ここは描画に依存しない純粋な状態だけを持つ。
 */
import type { CreateLoanResult } from '../../api-client/loan-api';
import type { LoanPeriodDays, Problem } from '../../api-client/loan-api-types';

export type LoanCheckoutVariant = 'default' | 'completed' | 'notLendable' | 'error';

export interface LoanCheckoutInput {
  patronNumber: string;
  bookId: string;
}

/** packages/ui の Alert の variant のうち、この画面が使うもの */
export type LoanCheckoutAlertVariant = 'success' | 'warning' | 'destructive';

export interface LoanCheckoutAlert {
  variant: LoanCheckoutAlertVariant;
  title: string;
  message: string;
}

/** 貸出内容カードに出す値 (story の completed variant) */
export interface CompletedLoan {
  loanId: string;
  bookId: string;
  patronNumber: string;
  loanedOn: string;
  loanPeriodDays: LoanPeriodDays;
  dueOn: string;
  /** DueDateDisplay の daysLeft。登録直後なので返却期限までの日数 = 貸出期間 */
  daysLeft: number;
}

export interface LoanCheckoutView {
  variant: LoanCheckoutVariant;
  input: LoanCheckoutInput;
  /** CounterLookup の patronError */
  patronError?: string;
  /** CounterLookup の bookError */
  bookError?: string;
  alert?: LoanCheckoutAlert;
  loan?: CompletedLoan;
}

// 契約 createLoan の応答ステータス
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

/** 契約 409 / 404 の code のうち、利用者に起因するもの (それ以外は書籍に起因する) */
const PATRON_PROBLEM_CODES: ReadonlySet<string> = new Set(['patron-not-found', 'patron-has-overdue-loan']);

// story の文言 (packages/ui/stories/LoanCheckout.stories.tsx)
const COMPLETED_TITLE = '貸出を登録しました';
const NOT_LENDABLE_TITLE = 'この書籍は貸し出せません';
const ERROR_TITLE = '貸出を登録できませんでした';
const NETWORK_ERROR_MESSAGE = '通信に失敗しました。貸出は登録されていません。時間をおいて再度お試しください。';
const GENERIC_ERROR_MESSAGE = '貸出は登録されていません。時間をおいて再度お試しください。';

/** createLoan の HTTP ステータスから画面の variant を決める */
export function toLoanCheckoutVariant(httpStatus: number): LoanCheckoutVariant {
  if (httpStatus === HTTP_CREATED) return 'completed';
  if (httpStatus === HTTP_CONFLICT || httpStatus === HTTP_NOT_FOUND) return 'notLendable';
  if (httpStatus === HTTP_BAD_REQUEST) return 'default';
  return 'error';
}

/** 入力前の初期状態 */
export function initialLoanCheckoutView(): LoanCheckoutView {
  return { variant: 'default', input: { patronNumber: '', bookId: '' } };
}

function errorView(input: LoanCheckoutInput, message: string): LoanCheckoutView {
  return { variant: 'error', input, alert: { variant: 'destructive', title: ERROR_TITLE, message } };
}

function notLendableView(input: LoanCheckoutInput, problem: Problem | null): LoanCheckoutView {
  const message = problem?.detail ?? problem?.title ?? NOT_LENDABLE_TITLE;
  const view: LoanCheckoutView = {
    variant: 'notLendable',
    input,
    alert: { variant: 'warning', title: problem?.title ?? NOT_LENDABLE_TITLE, message },
  };
  if (problem?.code !== undefined && PATRON_PROBLEM_CODES.has(problem.code)) {
    view.patronError = message;
  } else {
    view.bookError = message;
  }
  return view;
}

function validationView(input: LoanCheckoutInput, problem: Problem | null): LoanCheckoutView {
  const view: LoanCheckoutView = { variant: 'default', input };
  for (const fieldError of problem?.errors ?? []) {
    if (fieldError.field === 'patronNumber') view.patronError = fieldError.message;
    if (fieldError.field === 'bookId') view.bookError = fieldError.message;
  }
  if (view.patronError === undefined && view.bookError === undefined) {
    return errorView(input, problem?.detail ?? problem?.title ?? GENERIC_ERROR_MESSAGE);
  }
  return view;
}

/** createLoan の結果から貸出受付画面の状態を組み立てる */
export function toLoanCheckoutView(input: LoanCheckoutInput, result: CreateLoanResult): LoanCheckoutView {
  if (result.kind === 'network-error') return errorView(input, NETWORK_ERROR_MESSAGE);

  const variant = toLoanCheckoutVariant(result.status);
  if (result.kind === 'created') {
    const { loan } = result;
    return {
      variant,
      input,
      alert: {
        variant: 'success',
        title: COMPLETED_TITLE,
        message: `利用者 ${loan.patronNumber} に貸し出しました。返却期限を利用者にお伝えください。`,
      },
      loan: {
        loanId: loan.loanId,
        bookId: loan.bookId,
        patronNumber: loan.patronNumber,
        loanedOn: loan.loanedOn,
        loanPeriodDays: loan.loanPeriodDays,
        dueOn: loan.dueOn,
        daysLeft: loan.loanPeriodDays,
      },
    };
  }

  switch (variant) {
    case 'notLendable':
      return notLendableView(input, result.problem);
    case 'default':
      return validationView(input, result.problem);
    default:
      return errorView(input, result.problem?.detail ?? result.problem?.title ?? GENERIC_ERROR_MESSAGE);
  }
}
