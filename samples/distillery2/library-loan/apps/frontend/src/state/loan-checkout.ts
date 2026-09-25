/**
 * 貸出受付画面の状態 (state 層)。
 * 画面の送信操作をブラウザ無しで呼べる入口関数 submitLoanCheckout として公開する。
 */
import type { FieldError, Loan, Problem } from '../../../../packages/contracts/api/types';
import { type ApiOptions, type LoanCheckoutInput, registerLoan } from '../api-client/loan-api';

// view は api-client を直接参照しない (ADR 0003) ため、入口関数の引数型は state から公開する
export type { ApiOptions, LoanCheckoutInput };

/** 貸出受付フォームの項目名 (packages/ui の LoanCheckoutForm と同じ名前)。 */
export type LoanCheckoutField = 'patronNo' | 'copyId';

/** 送信結果の表示状態。 */
export type LoanCheckoutView =
  | { kind: 'success'; loan: Loan }
  | {
      kind: 'error';
      title: string;
      detail?: string;
      fieldErrors?: Partial<Record<LoanCheckoutField, string>>;
    };

/** 応答が Problem で読めないとき (通信失敗・想定外の応答) に見せる文言。 */
export const UNEXPECTED_ERROR_TITLE = '貸出を登録できませんでした';
export const UNEXPECTED_ERROR_DETAIL = '時間をおいてもう一度お試しください。';

/** 契約の項目名 (CreateLoanRequest) → フォームの項目名。 */
const FIELD_OF: Record<string, LoanCheckoutField> = {
  patron_number: 'patronNo',
  copy_id: 'copyId',
};

function isProblem(data: unknown): data is Problem {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { title?: unknown }).title === 'string'
  );
}

function toFieldErrors(
  errors: FieldError[] | undefined,
): Partial<Record<LoanCheckoutField, string>> | undefined {
  const result: Partial<Record<LoanCheckoutField, string>> = {};
  for (const e of errors ?? []) {
    const field = FIELD_OF[e.field];
    if (field && result[field] === undefined) result[field] = e.message;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function toErrorView(problem: Problem): LoanCheckoutView {
  const view: LoanCheckoutView = { kind: 'error', title: problem.title };
  if (problem.detail !== undefined) view.detail = problem.detail;
  const fieldErrors = toFieldErrors(problem.errors);
  if (fieldErrors) view.fieldErrors = fieldErrors;
  return view;
}

const unexpectedError: LoanCheckoutView = {
  kind: 'error',
  title: UNEXPECTED_ERROR_TITLE,
  detail: UNEXPECTED_ERROR_DETAIL,
};

/**
 * 貸出受付画面の「貸し出す」操作。
 * createLoan を呼び、201 は貸出、4xx/5xx は Problem の title/detail を表示状態に変える。
 */
export async function submitLoanCheckout(
  input: LoanCheckoutInput,
  options: ApiOptions = {},
): Promise<LoanCheckoutView> {
  let result: Awaited<ReturnType<typeof registerLoan>>;
  try {
    result = await registerLoan(input, options);
  } catch {
    return unexpectedError;
  }
  if (result.status === 201) return { kind: 'success', loan: result.data };
  return isProblem(result.data) ? toErrorView(result.data) : unexpectedError;
}
